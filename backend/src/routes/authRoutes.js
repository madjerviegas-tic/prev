const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient, Role } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();
const prisma = new PrismaClient();
const router = express.Router();

// Criar usuário admin inicial
router.post('/init-admin', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hash,
        role: Role.ADMIN
      }
    });
    res.json({ message: 'Admin criado', user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao criar admin' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Usuário ou senha inválidos' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Usuário ou senha inválidos' });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro no login' });
  }
});

module.exports = router;
