import { Request, Response } from 'express';
import { calcularSmartBuy, InputSimulacion } from './motorFinanciero';
import { pool } from './db';

function numero(valor: any): number {
  const n = Number(valor);
  return isNaN(n) ? 0 : n;
}

function obtenerTipoGracia(datos: InputSimulacion): 'Sin Gracia' | 'Total' | 'Parcial' {
  if (datos.mesesGraciaTo > 0) return 'Total';
  if (datos.mesesGraciaPa > 0) return 'Parcial';
  return 'Sin Gracia';
}

export const generarSimulacion = async (req: Request, res: Response) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const datosEntrada: InputSimulacion = req.body;
    const cuerpo = req.body as any;
    const usuario = (req as any).usuario;

    if (!usuario) return res.status(401).json({ exito: false, mensaje: 'Usuario no autenticado' });

    const resultado = calcularSmartBuy(datosEntrada);
    const tipoGracia = obtenerTipoGracia(datosEntrada);
    const moneda = cuerpo.moneda === 'Soles' ? 'Soles' : 'Dolares';

    await connection.beginTransaction();

    const [insertSimulacion]: any = await connection.execute(
      `INSERT INTO simulacion_credito (
        id_usuario, moneda, precio_vehiculo, porc_cuota_inicial, monto_financiar, 
        porc_cuota_final, monto_cuota_final, tipo_tasa, tasa_interes, periodo_capitalizacion, 
        plazo_meses, tipo_gracia, meses_gracia_total, meses_gracia_parcial, tasa_desgravamen, 
        seguro_vehicular, cok_anual, tipo_cambio, tem, monto_cuota, interes_total, tcea, van, tir
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario.idUsuario, moneda, numero(datosEntrada.precioVehiculo), numero(datosEntrada.porcCuotaInicial),
        numero(resultado.montoPrestamo), numero(datosEntrada.porcCuotaFinal), numero(resultado.montoCuotaFin),
        datosEntrada.tipoTasa, numero(datosEntrada.tasaInteres), numero(datosEntrada.capTasa),
        numero(datosEntrada.plazoMeses), tipoGracia, numero(datosEntrada.mesesGraciaTo), 
        numero(datosEntrada.mesesGraciaPa), numero(datosEntrada.tasaDesgravamen), numero(datosEntrada.montoSeguroVehic),
        numero(datosEntrada.cokAnual), numero(cuerpo.tipoCambio ?? 3.75), numero(resultado.tem),
        numero(resultado.cuotaMensual), numero(resultado.interesTotal), numero(resultado.tcea),
        numero(resultado.van), numero(resultado.tir)
      ]
    );

    const idSimulacion = insertSimulacion.insertId;

    for (const fila of resultado.cronograma) {
      const segurosTotal = fila.seguroDesgravamen + fila.seguroVehicular;
      let cuotaPrestamo = (fila.tipoGracia === 'total') ? 0 : 
                          (fila.tipoGracia === 'parcial') ? fila.interes : 
                          (fila.interes + fila.amortizacion);
      
      const cuotaTotal = cuotaPrestamo + segurosTotal;

      await connection.execute(
        `INSERT INTO cronograma_pago (
          id_simulacion, num_cuota, saldo_inicial, interes, cuota, amortizacion, 
          seguro_desgravamen, seguro_vehicular, seguros_total, saldo_final, flujo_caja_neto, tipo_gracia
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idSimulacion, numero(fila.numeroCuota), numero(fila.saldoInicial), numero(fila.interes),
          numero(cuotaTotal), numero(fila.amortizacion), numero(fila.seguroDesgravamen),
          numero(fila.seguroVehicular), numero(segurosTotal), numero(fila.saldoFinal),
          numero(cuotaTotal), fila.tipoGracia
        ]
      );
    }

    await connection.commit();

    // AQUÍ ESTÁ EL CAMBIO: Enviamos el cronograma de vuelta
    return res.status(201).json({
      exito: true,
      mensaje: 'Simulación calculada y guardada correctamente',
      cronograma: resultado.cronograma, 
      resumen: {
        montoPrestamo: resultado.montoPrestamo,
        montoCuotaFin: resultado.montoCuotaFin,
        tem: resultado.tem,
        cuotaMensual: resultado.cuotaMensual,
        interesTotal: resultado.interesTotal,
        tcea: resultado.tcea,
        van: resultado.van,
        tir: resultado.tir
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al calcular o guardar la simulación:', error);
    
    // Mejor manejo de error para que sepas qué columna falla
    const sqlError = (error as any).sqlMessage || (error as any).message;
    return res.status(400).json({
      exito: false,
      mensaje: 'Error de BD: ' + sqlError
    });
  } finally {
    if (connection) connection.release();
  }
};

export const listarSimulaciones = async (req: Request, res: Response) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const usuario = (req as any).usuario;
    if (!usuario) return res.status(401).json({ exito: false, mensaje: 'Usuario no autenticado' });

    let query = `SELECT id_simulacion, moneda, precio_vehiculo, monto_financiar, monto_cuota, tcea, van, tir FROM simulacion_credito`;
    const valores: any[] = [];
    if (usuario.rol === 'CLIENTE') {
      query += ` WHERE id_usuario = ?`;
      valores.push(usuario.idUsuario);
    }
    query += ` ORDER BY id_simulacion DESC`;

    const [simulaciones]: any = await connection.execute(query, valores);
    return res.status(200).json({ exito: true, datos: simulaciones });
  } catch (error) {
    return res.status(500).json({ exito: false, mensaje: 'Error al listar' });
  } finally {
    if (connection) connection.release();
  }
};

export const obtenerSimulacionPorId = async (req: Request, res: Response) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const idSimulacion = Number(req.params.id);
        const [simulaciones]: any = await connection.execute('SELECT * FROM simulacion_credito WHERE id_simulacion = ?', [idSimulacion]);
        const [cronograma]: any = await connection.execute('SELECT * FROM cronograma_pago WHERE id_simulacion = ? ORDER BY num_cuota ASC', [idSimulacion]);
        
        return res.status(200).json({ exito: true, simulacion: simulaciones[0], cronograma });
    } catch (error) {
        return res.status(500).json({ exito: false, mensaje: 'Error al obtener' });
    } finally {
        if (connection) connection.release();
    }
};

export const eliminarSimulacion = async (req: Request, res: Response) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const idSimulacion = Number(req.params.id);
        await connection.execute('DELETE FROM cronograma_pago WHERE id_simulacion = ?', [idSimulacion]);
        await connection.execute('DELETE FROM simulacion_credito WHERE id_simulacion = ?', [idSimulacion]);
        await connection.commit();
        return res.status(200).json({ exito: true, mensaje: 'Eliminado' });
    } catch (error) {
        if (connection) await connection.rollback();
        return res.status(500).json({ exito: false, mensaje: 'Error al eliminar' });
    } finally {
        if (connection) connection.release();
    }
};
