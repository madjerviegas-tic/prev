// backend/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Middleware simples para garantir ADMIN
function ensureAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso permitido somente para ADMIN.' });
  }
  next();
}

// GET /api/users -> listar usuários (somente ADMIN)
router.get('/', authMiddleware, ensureAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { id: 'asc' }
    });
    res.json(users);
  } catch (err) {
    console.error('Erro ao listar usuários', err);
    res.status(500).json({ message: 'Erro ao listar usuários' });
  }
});

// POST /api/users -> criar usuário (somente ADMIN)
router.post('/', authMiddleware, ensureAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nome, email e senha são obrigatórios.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Já existe um usuário com este email.' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        // 🔴 ATENÇÃO AQUI:
        // Se no seu Prisma o campo é "passwordHash", troque "password" por "passwordHash"
        password: hashed,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    res.status(201).json(newUser);
  } catch (err) {
    console.error('Erro ao criar usuário', err);
    res.status(500).json({ message: 'Erro ao criar usuário' });
  }
});

// DELETE /api/users/:id -> remover usuário (somente ADMIN)
router.delete('/:id', authMiddleware, ensureAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido.' });
    }

    // impede remover a si mesmo
    if (req.user && req.user.id === id) {
      return res.status(400).json({ message: 'Você não pode remover o próprio usuário logado.' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Usuário removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover usuário', err);
    res.status(500).json({ message: 'Erro ao remover usuário' });
  }
});

module.exports = router;
