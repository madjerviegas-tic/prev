const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, isAdmin } = require('../authMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

// Listar computadores com filtros
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      search,
      location,
      os,
      next_from,
      next_to,
      page = 1,
      pageSize = 20
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (os) {
      where.os = { contains: os, mode: 'insensitive' };
    }

    if (next_from || next_to) {
      where.nextPreventiveDate = {};
      if (next_from) where.nextPreventiveDate.gte = new Date(next_from);
      if (next_to) where.nextPreventiveDate.lte = new Date(next_to);
    }

    const [total, data] = await Promise.all([
      prisma.computer.count({ where }),
      prisma.computer.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'asc' }
      })
    ]);

    res.json({ total, data, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao listar computadores' });
  }
});

// Detalhe
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const comp = await prisma.computer.findUnique({ where: { id } });
    if (!comp) return res.status(404).json({ message: 'Computador não encontrado' });
    res.json(comp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar computador' });
  }
});

// Criar (ADMIN)
router.post('/', authMiddleware, isAdmin, async (req, res) => {
  try {
    const {
      name,
      manufacturer,
      location,
      serialNumber,
      os,
      lastPreventiveDate,
      nextPreventiveDate
    } = req.body;

    const comp = await prisma.computer.create({
      data: {
        name,
        manufacturer,
        location,
        serialNumber,
        os,
        lastPreventiveDate: lastPreventiveDate ? new Date(lastPreventiveDate) : null,
        nextPreventiveDate: nextPreventiveDate ? new Date(nextPreventiveDate) : null
      }
    });

    res.status(201).json(comp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao criar computador' });
  }
});

// Atualizar (ADMIN)
router.put('/:id', authMiddleware, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      name,
      manufacturer,
      location,
      serialNumber,
      os,
      lastPreventiveDate,
      nextPreventiveDate
    } = req.body;

    const comp = await prisma.computer.update({
      where: { id },
      data: {
        name,
        manufacturer,
        location,
        serialNumber,
        os,
        lastPreventiveDate: lastPreventiveDate ? new Date(lastPreventiveDate) : null,
        nextPreventiveDate: nextPreventiveDate ? new Date(nextPreventiveDate) : null
      }
    });

    res.json(comp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao atualizar computador' });
  }
});

// Deletar (ADMIN)
router.delete('/:id', authMiddleware, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.computer.delete({ where: { id } });
    res.json({ message: 'Computador removido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao deletar computador' });
  }
});

// Bulk update (ADMIN)
router.post('/bulk-update', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { ids, fields } = req.body;

    const data = {};
    if (fields.manufacturer !== undefined) data.manufacturer = fields.manufacturer;
    if (fields.location !== undefined) data.location = fields.location;
    if (fields.os !== undefined) data.os = fields.os;
    if (fields.lastPreventiveDate !== undefined)
      data.lastPreventiveDate = fields.lastPreventiveDate ? new Date(fields.lastPreventiveDate) : null;
    if (fields.nextPreventiveDate !== undefined)
      data.nextPreventiveDate = fields.nextPreventiveDate ? new Date(fields.nextPreventiveDate) : null;

    const result = await prisma.computer.updateMany({
      where: { id: { in: ids.map(Number) } },
      data
    });

    res.json({ updated_count: result.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro no bulk update' });
  }
});

module.exports = router;
