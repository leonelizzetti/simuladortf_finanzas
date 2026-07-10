import { Router } from 'express';
import { 
  generarSimulacion, 
  eliminarSimulacion,
  listarSimulaciones,
  obtenerSimulacionPorId,
  actualizarEstadoSimulacion,
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
  '/simulacion/:id',
  verificarToken,
  eliminarSimulacion
);

router.put(
  '/simulacion/:id/estado', 
  verificarToken, 
  verificarRol('ADMINISTRADOR', 'ASESOR'), 
  actualizarEstadoSimulacion
);

export default router;