import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { pool } from './db';

export const registrarAsesor = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Debe ingresar username y password'
      });
    }

    const passwordEncriptada = await bcrypt.hash(password, 10);

    const [resultado]: any = await connection.execute(
      `
      INSERT INTO usuario (
        username,
        password,
        rol,
        estado
      )
      VALUES (?, ?, 'ASESOR', 'ACTIVO')
      `,
      [username, passwordEncriptada]
    );

    return res.status(201).json({
      exito: true,
      mensaje: 'Asesor registrado correctamente',
      asesor: {
        idUsuario: resultado.insertId,
        username,
        rol: 'ASESOR',
        estado: 'ACTIVO'
      }
    });

  } catch (error: any) {
    console.error('Error al registrar asesor:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        exito: false,
        mensaje: 'El username ya existe'
      });
    }

    return res.status(500).json({
      exito: false,
      mensaje: 'Error al registrar asesor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });

  } finally {
    connection.release();
  }
};