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

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al conectar con MySQL:', error);
  }
}

iniciarServidor();