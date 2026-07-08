import * as bcrypt from 'bcrypt';
import { pool } from './db';

async function crearUsuarios() {
  const usuarios = [
    {
      username: 'admin',
      password: 'admin123',
      rol: 'ADMINISTRADOR'
    },
    {
      username: 'asesor',
      password: 'asesor123',
      rol: 'ASESOR'
    },
    {
      username: 'cliente',
      password: 'cliente123',
      rol: 'CLIENTE'
    }
  ];

  for (const usuario of usuarios) {
    const passwordEncriptada = await bcrypt.hash(usuario.password, 10);

    await pool.execute(
      `
      INSERT INTO usuario (username, password, rol, estado)
      VALUES (?, ?, ?, 'ACTIVO')
      ON DUPLICATE KEY UPDATE
        password = VALUES(password),
        rol = VALUES(rol),
        estado = 'ACTIVO'
      `,
      [usuario.username, passwordEncriptada, usuario.rol]
    );
  }

  console.log('Usuarios creados correctamente');
}

crearUsuarios()
  .catch((error) => {
    console.error('Error creando usuarios:', error);
  })
  .finally(() => {
    pool.end();
  });