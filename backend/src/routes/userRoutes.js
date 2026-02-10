const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../authMiddleware');
// se seu authMiddleware exportar também isAdmin, pode usar:
// const { authMiddleware, isAdmin } = require('../authMiddleware');

// Middleware simples para garantir ADMIN
async function ensureAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso permitido somente para ADMIN.' });
  }
  next();
}

// Helper para contar quantos admins existem
async function countAdmins() {
  return prisma.user.count({
    where: { role: 'ADMIN' }
  });
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
        // ⚠️ Campo conforme schema.prisma
        passwordHash: hashed, // se no schema for "passwordHash String"
        // se for "password String", troque por: password: hashed,
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

// PATCH /api/users/:id -> editar nome/role (somente ADMIN)
router.patch('/:id', authMiddleware, ensureAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, role } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido.' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Impede que um admin tire o próprio ADMIN (se for o último)
    if (user.role === 'ADMIN' && role === 'USER') {
      const totalAdmins = await countAdmins();
      if (totalAdmins <= 1) {
        return res.status(400).json({
          message: 'Não é permitido remover o perfil ADMIN do último administrador.'
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: name || user.name,
        role: role || user.role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    res.json(updated);
  } catch (err) {
    console.error('Erro ao editar usuário', err);
    res.status(500).json({ message: 'Erro ao editar usuário' });
  }
});

// POST /api/users/:id/reset-password -> redefinir senha (somente ADMIN)
router.post('/:id/reset-password', authMiddleware, ensureAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { newPassword } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido.' });
    }
    if (!newPassword) {
      return res.status(400).json({ message: 'Nova senha é obrigatória.' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashed // ou password: hashed, conforme schema
      }
    });

    res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    console.error('Erro ao redefinir senha', err);
    res.status(500).json({ message: 'Erro ao redefinir senha do usuário' });
  }
});

// DELETE /api/users/:id -> remover usuário (somente ADMIN)
router.delete('/:id', authMiddleware, ensureAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido.' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // impede remover a si mesmo
    if (req.user && req.user.id === id) {
      return res.status(400).json({ message: 'Você não pode remover o próprio usuário logado.' });
    }

    // impede remover o último ADMIN
    if (user.role === 'ADMIN') {
      const totalAdmins = await countAdmins();
      if (totalAdmins <= 1) {
        return res.status(400).json({
          message: 'Não é permitido remover o último administrador do sistema.'
        });
      }
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Usuário removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover usuário', err);
    res.status(500).json({ message: 'Erro ao remover usuário' });
  }
});

module.exports = router;
