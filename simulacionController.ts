import { Request, Response } from 'express';
import { calcularSmartBuy, InputSimulacion } from './motorFinanciero';
import { pool } from './db';

function numero(valor: any): number {
  const n = Number(valor);
  return isNaN(n) ? 0 : n;
}

function obtenerTipoGracia(datos: InputSimulacion): 'Sin Gracia' | 'Total' | 'Parcial' {
  if (datos.mesesGraciaTo > 0) {
    return 'Total';
  }

  if (datos.mesesGraciaPa > 0) {
    return 'Parcial';
  }

  return 'Sin Gracia';
}

export const generarSimulacion = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();

  try {
    const datosEntrada: InputSimulacion = req.body;
    const cuerpo = req.body as any;
    const usuario = (req as any).usuario;

    if (!usuario) {
      connection.release();
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario no autenticado'
      });
    }

    const resultado = calcularSmartBuy(datosEntrada);

    if (cuerpo.guardar !== true) {
      connection.release();
      return res.status(200).json({
        exito: true,
        mensaje: 'Simulación calculada temporalmente',
        resumen: {
          montoPrestamo: resultado.montoPrestamo,
          montoCuotaFin: resultado.montoCuotaFin,
          tem: resultado.tem,
          cuotaMensual: resultado.cuotaMensual,
          interesTotal: resultado.interesTotal,
          tcea: resultado.tcea,
          van: resultado.van,
          tir: resultado.tir,
          totalCuotas: resultado.cronograma.length
        },
        cronograma: resultado.cronograma
      });
    }

    const tipoGracia = obtenerTipoGracia(datosEntrada);
    const moneda = cuerpo.moneda === 'Soles' ? 'Soles' : 'Dolares';

    await connection.beginTransaction();

    const [insertSimulacion]: any = await connection.execute(
      `
      INSERT INTO simulacion_credito (
        id_usuario, moneda, precio_vehiculo, porc_cuota_inicial, monto_financiar,
        porc_cuota_final, monto_cuota_final, tipo_tasa, tasa_interes, periodo_capitalizacion,
        plazo_meses, tipo_gracia, meses_gracia_total, meses_gracia_parcial, tasa_desgravamen,
        seguro_vehicular, cok_anual, tipo_cambio, tem, monto_cuota, interes_total, tcea, van, tir, estado
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        usuario.idUsuario, moneda, numero(datosEntrada.precioVehiculo), numero(datosEntrada.porcCuotaInicial),
        numero(resultado.montoPrestamo), numero(datosEntrada.porcCuotaFinal), numero(resultado.montoCuotaFin),
        datosEntrada.tipoTasa, numero(datosEntrada.tasaInteres), numero(datosEntrada.capTasa),
        numero(datosEntrada.plazoMeses), tipoGracia, numero(datosEntrada.mesesGraciaTo),
        numero(datosEntrada.mesesGraciaPa), numero(datosEntrada.tasaDesgravamen),
        numero(datosEntrada.montoSeguroVehic), numero(datosEntrada.cokAnual), numero(cuerpo.tipoCambio ?? 3.75),
        numero(resultado.tem), numero(resultado.cuotaMensual), numero(resultado.interesTotal),
        numero(resultado.tcea), numero(resultado.van), numero(resultado.tir), 'Pendiente'
      ]
    );

    const idSimulacion = insertSimulacion.insertId;

    for (const fila of resultado.cronograma) {
      const segurosTotal = fila.seguroDesgravamen + fila.seguroVehicular;
      const cuotaTotal = fila.cuota + segurosTotal;

      await connection.execute(
        `
        INSERT INTO cronograma_pago (
          id_simulacion, num_cuota, saldo_inicial, interes, cuota, amortizacion,
          seguro_desgravamen, seguro_vehicular, seguros_total, saldo_final, flujo_caja_neto, tipo_gracia
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idSimulacion, numero(fila.numeroCuota), numero(fila.saldoInicial), numero(fila.interes),
          numero(cuotaTotal), numero(fila.amortizacion), numero(fila.seguroDesgravamen),
          numero(fila.seguroVehicular), numero(segurosTotal), numero(fila.saldoFinal),
          numero(fila.flujoCajaNeto), fila.tipoGracia
        ]
      );
    }

    await connection.commit();

    return res.status(201).json({
      exito: true,
      mensaje: 'Simulación guardada correctamente en la base de datos',
      idSimulacion
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    return res.status(400).json({
      exito: false,
      mensaje: 'Error al calcular o guardar la simulación.',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  } finally {
    connection.release();
  }
};

export const listarSimulaciones = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();

  try {
    const usuario = (req as any).usuario;

    if (!usuario) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario no autenticado'
      });
    }

    let query = `
      SELECT 
        id_simulacion,
        id_usuario,
        fecha_simulacion,
        moneda,
        precio_vehiculo,
        monto_financiar,
        monto_cuota_final,
        monto_cuota,
        tcea,
        van,
        tir,
        tipo_gracia,
        plazo_meses,
        estado
      FROM simulacion_credito
    `;

    const valores: any[] = [];

    if (usuario.rol === 'CLIENTE') {
      query += `
        WHERE id_usuario = ?
      `;
      valores.push(usuario.idUsuario);
    }

    query += `
      ORDER BY id_simulacion DESC
    `;

    const [simulaciones]: any = await connection.execute(query, valores);

    return res.status(200).json({
      exito: true,
      mensaje: 'Simulaciones obtenidas correctamente',
      rol: usuario.rol,
      idUsuario: usuario.idUsuario,
      total: simulaciones.length,
      datos: simulaciones
    });

  } catch (error) {
    console.error('Error al listar simulaciones:', error);

    return res.status(500).json({
      exito: false,
      mensaje: 'Error al obtener las simulaciones',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });

  } finally {
    connection.release();
  }
};

export const obtenerSimulacionPorId = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();

  try {
    const idSimulacion = Number(req.params.id);
    const usuario = (req as any).usuario;

    if (!usuario) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario no autenticado'
      });
    }

    if (isNaN(idSimulacion) || idSimulacion <= 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'El id de la simulación no es válido'
      });
    }

    let query = `
      SELECT *
      FROM simulacion_credito
      WHERE id_simulacion = ?
    `;

    const valores: any[] = [idSimulacion];

    if (usuario.rol === 'CLIENTE') {
      query += `
        AND id_usuario = ?
      `;
      valores.push(usuario.idUsuario);
    }

    const [simulaciones]: any = await connection.execute(query, valores);

    if (simulaciones.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'No se encontró la simulación indicada o no pertenece al usuario'
      });
    }

    const [cronograma]: any = await connection.execute(
      `
      SELECT *
      FROM cronograma_pago
      WHERE id_simulacion = ?
      ORDER BY num_cuota ASC
      `,
      [idSimulacion]
    );

    return res.status(200).json({
      exito: true,
      mensaje: 'Simulación obtenida correctamente',
      rol: usuario.rol,
      idUsuario: usuario.idUsuario,
      simulacion: simulaciones[0],
      cronograma
    });

  } catch (error) {
    console.error('Error al obtener la simulación:', error);

    return res.status(500).json({
      exito: false,
      mensaje: 'Error al obtener la simulación',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });

  } finally {
    connection.release();
  }
};

export const eliminarSimulacion = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();

  try {
    const idSimulacion = Number(req.params.id);

    const usuario = (req as any).usuario;

    if (isNaN(idSimulacion) || idSimulacion <= 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'El id de la simulación no es válido'
      });
    }

    await connection.beginTransaction();

    const [simulaciones]: any = await connection.execute(
      `
      SELECT id_simulacion
      FROM simulacion_credito
      WHERE id_simulacion = ?
      `,
      [idSimulacion]
    );

    if (simulaciones.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        exito: false,
        mensaje: 'No se encontró la simulación indicada'
      });
    }

    const simulacion = simulaciones[0];

    if (usuario.rol === 'CLIENTE' && simulacion.id_usuario !== usuario.idUsuario) {
      await connection.rollback();
      return res.status(403).json({
        exito: false,
        mensaje: 'Acceso denegado: No tienes permiso para eliminar esta simulación'
      });
    }

    await connection.execute(
      `
      DELETE FROM cronograma_pago
      WHERE id_simulacion = ?
      `,
      [idSimulacion]
    );

    await connection.execute(
      `
      DELETE FROM simulacion_credito
      WHERE id_simulacion = ?
      `,
      [idSimulacion]
    );

    await connection.commit();

    return res.status(200).json({
      exito: true,
      mensaje: 'Simulación y cronograma eliminados correctamente',
      idSimulacion
    });

  } catch (error) {
    await connection.rollback();

    console.error('Error al eliminar la simulación:', error);

    return res.status(500).json({
      exito: false,
      mensaje: 'Error al eliminar la simulación',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });

  } finally {
    connection.release();
  }
};

export const actualizarEstadoSimulacion = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { estado } = req.body; // 'Aprobado', 'Rechazado', 'Pendiente'
    
    try {
        const connection = await pool.getConnection();
        await connection.execute(
            `UPDATE simulacion_credito SET estado = ? WHERE id_simulacion = ?`,
            [estado, id]
        );
        connection.release();
        return res.status(200).json({ exito: true, mensaje: 'Estado actualizado' });
    } catch (error) {
        return res.status(500).json({ exito: false, mensaje: 'Error al actualizar' });
    }
};
