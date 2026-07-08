import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { pool } from './db';

export const login = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Debe ingresar username y password'
      });
    }

    const [usuarios]: any = await connection.execute(
      `
      SELECT 
        id_usuario,
        username,
        password,
        rol,
        estado
      FROM usuario
      WHERE username = ?
      `,
      [username]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario o contraseña incorrectos'
      });
    }

    const usuario = usuarios[0];

    if (usuario.estado !== 'ACTIVO') {
      return res.status(403).json({
        exito: false,
        mensaje: 'El usuario está inactivo'
      });
    }

    const passwordCorrecto = await bcrypt.compare(password, usuario.password);

    if (!passwordCorrecto) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario o contraseña incorrectos'
      });
    }

    const payload = {
      idUsuario: usuario.id_usuario,
      username: usuario.username,
      rol: usuario.rol
    };

    const secret = process.env.JWT_SECRET || 'clave_desarrollo';

    const options: jwt.SignOptions = {
      expiresIn: '2h'
    };

    const token = jwt.sign(payload, secret, options);

    return res.status(200).json({
      exito: true,
      mensaje: 'Login correcto',
      usuario: {
        idUsuario: usuario.id_usuario,
        username: usuario.username,
        rol: usuario.rol
      },
      token
    });

  } catch (error) {
    console.error('Error en login:', error);

    return res.status(500).json({
      exito: false,
      mensaje: 'Error al iniciar sesión',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });

  } finally {
    connection.release();
  }
};