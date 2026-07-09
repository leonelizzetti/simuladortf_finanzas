import { Router } from 'express';
import { registrarAsesor, registrarUsuario } from './usuarioController';
import { verificarToken, verificarRol } from './authMiddleware';

const router = Router();

router.post(
  '/usuarios/asesores',
  verificarToken,
  verificarRol('ADMINISTRADOR'),
  registrarAsesor
);

router.post('/usuarios', registrarUsuario);

export default router;