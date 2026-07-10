import { Router } from 'express';
import { login } from './authController';
import { eliminarSimulacion } from './simulacionController'; 
import { verificarToken } from './authMiddleware'; // Quitamos verificarRol de aquí

const router = Router();

router.post('/login', login);

router.delete('/simulacion/:id', verificarToken, eliminarSimulacion);

export default router;