import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { pool } from './db';

export const registrarUsuario = async (req: Request, res: Response) => {
    let connection;

    try {
        const { username, password, nombres, apellidos, correo, telefono, rol, estado } = req.body;

        if (!username || !password || !nombres || !apellidos || !correo || !rol) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Faltan datos obligatorios'
            });
        }

        connection = await pool.getConnection();

        const [existingUser]: any = await connection.execute(
            `SELECT id_usuario FROM usuario WHERE username = ?`,
            [username]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'El usuario ya existe' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const estadoFinal = estado || 'ACTIVO';

        await connection.execute(
            `INSERT INTO usuario (username, password, nombres, apellidos, correo, telefono, rol, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, hashedPassword, nombres, apellidos, correo, telefono, rol, estadoFinal]
        );

        return res.status(201).json({
            exito: true,
            mensaje: 'Cuenta creada exitosamente'
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            exito: false,
            mensaje: 'Error al procesar el registro'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

export const registrarAsesor = async (req: Request, res: Response) => {
    let connection;

    try {
        const { username, password, nombres, apellidos, correo, telefono } = req.body;

        if (!username || !password || !nombres || !apellidos || !correo) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Faltan datos obligatorios'
            });
        }

        connection = await pool.getConnection();

        const [existingUser]: any = await connection.execute(
            `SELECT id_usuario FROM usuario WHERE username = ?`,
            [username]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'El usuario ya existe' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await connection.execute(
            `INSERT INTO usuario (username, password, nombres, apellidos, correo, telefono, rol, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, hashedPassword, nombres, apellidos, correo, telefono, 'ASESOR', 'ACTIVO']
        );

        return res.status(201).json({
            exito: true,
            mensaje: 'Asesor creado exitosamente'
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            exito: false,
            mensaje: 'Error al procesar el registro de asesor'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};