import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db';
import simulacionRoutes from './simulacionRoutes';
import authRoutes from './authRoutes';
import usuarioRoutes from './usuarioRoutes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend funcionando correctamente');
});

app.use('/', authRoutes);
app.use('/', simulacionRoutes);
app.use('/', usuarioRoutes); 

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
  try {
    const connection = await pool.getConnection();
    console.log('Conectado correctamente a MySQL');
    connection.release();
  } catch (error) {
    console.error('Advertencia: Base de datos lenta o apagada, pero el servidor seguirá corriendo:', error);
  }

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}

iniciarServidor();
