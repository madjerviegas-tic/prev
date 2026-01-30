const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../authMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

// Preventivas realizadas
router.get('/preventives-done', authMiddleware, async (req, res) => {
  try {
    const { from, to, location, os } = req.query;

    const where = {};

    if (from || to) {
      where.performedAt = {};
      if (from) where.performedAt.gte = new Date(from);
      if (to) where.performedAt.lte = new Date(to);
    }

    if (location || os) {
      where.computer = { AND: [] };
      if (location) where.computer.AND.push({ location: { contains: location, mode: 'insensitive' } });
      if (os) where.computer.AND.push({ os: { contains: os, mode: 'insensitive' } });
    }

    const logs = await prisma.preventiveLog.findMany({
      where,
      include: { computer: true }
    });

    res.json({
      total: logs.length,
      items: logs.map((l) => ({
        id: l.id,
        computer_id: l.computerId,
        computer_name: l.computer.name,
        performed_at: l.performedAt,
        location: l.computer.location,
        os: l.computer.os
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro em preventives-done' });
  }
});

// Preventivas pendentes
router.get('/preventives-pending', authMiddleware, async (req, res) => {
  try {
    const { until, location, os } = req.query;

    const today = new Date();
    const limitDate = until ? new Date(until) : today;

    const where = {
      nextPreventiveDate: { lte: limitDate }
    };

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }
    if (os) {
      where.os = { contains: os, mode: 'insensitive' };
    }

    const computers = await prisma.computer.findMany({ where });

    const items = computers.map((c) => ({
      id: c.id,
      name: c.name,
      nextPreventiveDate: c.nextPreventiveDate,
      status: c.nextPreventiveDate && c.nextPreventiveDate < today ? 'OVERDUE' : 'DUE_SOON'
    }));

    const overdue = items.filter((i) => i.status === 'OVERDUE').length;
    const due_soon = items.filter((i) => i.status === 'DUE_SOON').length;

    res.json({ overdue, due_soon, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro em preventives-pending' });
  }
});

// Resumo por localização
router.get('/by-location', authMiddleware, async (req, res) => {
  try {
    const result = await prisma.computer.groupBy({
      by: ['location'],
      _count: { _all: true }
    });

    res.json(
      result.map((r) => ({
        location: r.location,
        total: r._count._all
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro em by-location' });
  }
});

// Resumo por sistema operacional
router.get('/by-os', authMiddleware, async (req, res) => {
  try {
    const result = await prisma.computer.groupBy({
      by: ['os'],
      _count: { _all: true }
    });

    res.json(
      result.map((r) => ({
        os: r.os,
        total: r._count._all
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro em by-os' });
  }
});

module.exports = router;
