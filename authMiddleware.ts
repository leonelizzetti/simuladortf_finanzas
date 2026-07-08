import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const verificarToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        exito: false,
        mensaje: 'No se envió token de autorización'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Token no válido'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'clave_desarrollo'
    );

    (req as any).usuario = decoded;

    next();

  } catch (error) {
    return res.status(401).json({
      exito: false,
      mensaje: 'Token inválido o expirado'
    });
  }
};

export const verificarRol = (...rolesPermitidos: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const usuario = (req as any).usuario;

    if (!usuario) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario no autenticado'
      });
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      return res.status(403).json({
        exito: false,
        mensaje: 'No tiene permisos para acceder a esta ruta'
      });
    }

    next();
  };
};