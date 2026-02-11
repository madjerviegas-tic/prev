// backend/src/routes/calendarRoutes.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authMiddleware } = require('../authMiddleware');

// GET /api/calendar/preventives?year=2026
// Retorna as preventivas (nextPreventiveDate) agrupadas por dia dentro do ano informado
router.get('/preventives', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();

    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    // Ajuste os campos conforme seu modelo Computer:
    // aqui assumo que existe nextPreventiveDate, location, name, manufacturer
    const computers = await prisma.computer.findMany({
      where: {
        nextPreventiveDate: {
          gte: start,
          lt: end
        }
      },
      select: {
        id: true,
        name: true,
        manufacturer: true,
        location: true,
        nextPreventiveDate: true
      },
      orderBy: { nextPreventiveDate: 'asc' }
    });

    const byDay = {};

    computers.forEach(pc => {
      if (!pc.nextPreventiveDate) return;
      const iso = pc.nextPreventiveDate.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!byDay[iso]) byDay[iso] = [];
      byDay[iso].push({
        id: pc.id,
        name: pc.name,
        manufacturer: pc.manufacturer,
        location: pc.location,
        nextPreventiveDate: pc.nextPreventiveDate
      });
    });

    const days = Object.keys(byDay)
      .sort()
      .map(date => ({
        date,
        count: byDay[date].length,
        computers: byDay[date]
      }));

    res.json({
      year,
      totalEvents: computers.length,
      totalDays: days.length,
      days
    });
  } catch (err) {
    console.error('Erro ao gerar calendário de preventivas:', err);
    res.status(500).json({ message: 'Erro ao gerar calendário de preventivas.' });
  }
});

module.exports = router;
