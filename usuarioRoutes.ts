import { Router } from 'express';
import { registrarAsesor } from './usuarioController';
import { verificarToken, verificarRol } from './authMiddleware';

const router = Router();

router.post(
  '/usuarios/asesores',
  verificarToken,
  verificarRol('ADMINISTRADOR'),
  registrarAsesor
);

export default router;