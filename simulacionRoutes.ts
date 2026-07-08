import { Router } from 'express';
import { 
  generarSimulacion, 
  eliminarSimulacion,
  listarSimulaciones,
  obtenerSimulacionPorId
} from './simulacionController';

import { verificarToken, verificarRol } from './authMiddleware';

const router = Router();

router.post(
  '/simular',
  verificarToken,
  verificarRol('ADMINISTRADOR', 'ASESOR', 'CLIENTE'),
  generarSimulacion
);

router.get(
  '/simulaciones',
  verificarToken,
  verificarRol('ADMINISTRADOR', 'ASESOR', 'CLIENTE'),
  listarSimulaciones
);

router.get(
  '/simular/:id',
  verificarToken,
  verificarRol('ADMINISTRADOR', 'ASESOR', 'CLIENTE'),
  obtenerSimulacionPorId
);

router.delete(
  '/simular/:id',
  verificarToken,
  verificarRol('ADMINISTRADOR', 'ASESOR'),
  eliminarSimulacion
);

export default router;