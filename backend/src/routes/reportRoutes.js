// backend/src/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authMiddleware } = require('../middlewares/authMiddleware');

// Helper para somar dias
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ------------------------------
// 1) Preventivas pendentes
// ------------------------------
// GET /api/reports/preventives-pending?until=YYYY-MM-DD
router.get('/preventives-pending', authMiddleware, async (req, res) => {
  try {
    const { until } = req.query;
    const refDate = until ? new Date(until) : new Date();

    if (isNaN(refDate.getTime())) {
      return res.status(400).json({ message: 'Data inválida em "until"' });
    }

    // vencidas: próxima preventiva < hoje
    const overdue = await prisma.computer.count({
      where: {
        nextPreventiveDate: {
          lt: refDate
        }
      }
    });

    // a vencer até a data (inclui hoje)
    const pending = await prisma.computer.count({
      where: {
        nextPreventiveDate: {
          lte: refDate
        }
      }
    });

    res.json({
      until: refDate.toISOString().slice(0, 10),
      overdue,
      due_soon: pending - overdue < 0 ? 0 : pending - overdue,
      total_pending: pending
    });
  } catch (err) {
    console.error('Erro em /reports/preventives-pending', err);
    res.status(500).json({ message: 'Erro ao gerar relatório de pendências' });
  }
});

// ------------------------------
// 2) Distribuição por localização
// ------------------------------
// GET /api/reports/by-location
router.get('/by-location', authMiddleware, async (_req, res) => {
  try {
    const result = await prisma.computer.groupBy({
      by: ['location'],
      _count: { _all: true },
      orderBy: {
        _count: { _all: 'desc' }
      }
    });

    const mapped = result.map(r => ({
      location: r.location || 'Não informado',
      total: r._count._all
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Erro em /reports/by-location', err);
    res.status(500).json({ message: 'Erro ao gerar relatório por localização' });
  }
});

// ------------------------------
// 3) Distribuição por sistema operacional
// ------------------------------
// GET /api/reports/by-os
router.get('/by-os', authMiddleware, async (_req, res) => {
  try {
    const result = await prisma.computer.groupBy({
      by: ['os'],
      _count: { _all: true },
      orderBy: {
        _count: { _all: 'desc' }
      }
    });

    const mapped = result.map(r => ({
      os: r.os || 'Não informado',
      total: r._count._all
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Erro em /reports/by-os', err);
    res.status(500).json({ message: 'Erro ao gerar relatório por sistema operacional' });
  }
});

// ------------------------------
// 4) Distribuição por fabricante (NOVO)
// ------------------------------
// GET /api/reports/by-manufacturer
router.get('/by-manufacturer', authMiddleware, async (_req, res) => {
  try {
    const result = await prisma.computer.groupBy({
      by: ['manufacturer'],
      _count: { _all: true },
      orderBy: {
        _count: { _all: 'desc' }
      }
    });

    const mapped = result.map(r => ({
      manufacturer: r.manufacturer || 'Não informado',
      total: r._count._all
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Erro em /reports/by-manufacturer', err);
    res.status(500).json({ message: 'Erro ao gerar relatório por fabricante' });
  }
});

// ------------------------------
// 5) Resumo geral (NOVO)
// ------------------------------
// GET /api/reports/summary?until=YYYY-MM-DD
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const { until } = req.query;
    const refDate = until ? new Date(until) : new Date();

    if (isNaN(refDate.getTime())) {
      return res.status(400).json({ message: 'Data inválida em "until"' });
    }

    const today = new Date(refDate);
    today.setHours(0, 0, 0, 0);

    const next7 = addDays(today, 7);

    const [totalComputers, overdue, dueSoon7Days, noNextDate] = await Promise.all([
      prisma.computer.count(),
      prisma.computer.count({
        where: {
          nextPreventiveDate: {
            lt: today
          }
        }
      }),
      prisma.computer.count({
        where: {
          nextPreventiveDate: {
            gte: today,
            lte: next7
          }
        }
      }),
      prisma.computer.count({
        where: {
          nextPreventiveDate: null
        }
      })
    ]);

    res.json({
      until: today.toISOString().slice(0, 10),
      totalComputers,
      overdue,
      dueSoon7Days,
      noNextDate
    });
  } catch (err) {
    console.error('Erro em /reports/summary', err);
    res.status(500).json({ message: 'Erro ao gerar resumo geral' });
  }
});

// ------------------------------
// 6) Máquinas sem próxima data (NOVO)
// ------------------------------
// GET /api/reports/no-next-date
router.get('/no-next-date', authMiddleware, async (_req, res) => {
  try {
    const list = await prisma.computer.findMany({
      where: { nextPreventiveDate: null },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        location: true,
        os: true,
        manufacturer: true,
        serialNumber: true
      }
    });

    res.json({
      total: list.length,
      data: list
    });
  } catch (err) {
    console.error('Erro em /reports/no-next-date', err);
    res.status(500).json({ message: 'Erro ao gerar relatório de máquinas sem próxima preventiva' });
  }
});

module.exports = router;
