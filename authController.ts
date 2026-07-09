import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { pool } from './db';
import axios from 'axios'; // Importamos axios

export const login = async (req: Request, res: Response) => {
  let connection;

  try {
    const { username, password, recaptchaToken } = req.body; 
    if (!username || !password || !recaptchaToken) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Debe ingresar usuario, contraseña y completar el captcha'
      });
    }
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const googleResponse = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, null, {
        params: {
            secret: secretKey,
            response: recaptchaToken
        }
    });

    if (!googleResponse.data.success || googleResponse.data.score < 0.5) {
        return res.status(403).json({ 
            exito: false, 
            mensaje: "Acceso denegado: Bot detectado o validación fallida." 
        });
    }

    connection = await pool.getConnection();

    const [usuarios]: any = await connection.execute(
      `SELECT id_usuario, username, password, rol, estado FROM usuario WHERE username = ?`,
      [username]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ exito: false, mensaje: 'Usuario o contraseña incorrectos' });
    }

    const usuario = usuarios[0];

    if (usuario.estado !== 'ACTIVO') {
      return res.status(403).json({ exito: false, mensaje: 'El usuario está inactivo' });
    }

    const passwordCorrecto = await bcrypt.compare(password, usuario.password);

    if (!passwordCorrecto) {
      return res.status(401).json({ exito: false, mensaje: 'Usuario o contraseña incorrectos' });
    }

    const payload = {
      idUsuario: usuario.id_usuario,
      username: usuario.username,
      rol: usuario.rol
    };

    const secret = process.env.JWT_SECRET || 'clave_desarrollo';
    const options: jwt.SignOptions = { expiresIn: '2h' };
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
      mensaje: 'Error al conectar con el servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};