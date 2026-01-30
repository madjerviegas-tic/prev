const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, isAdmin } = require('../authMiddleware');

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/import-csv', authMiddleware, isAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado' });

    const csvBuffer = req.file.buffer.toString('utf-8');
    const records = [];
    const errors = [];

    await new Promise((resolve, reject) => {
      parse(
        csvBuffer,
        {
          columns: true,
          trim: true,
          skip_empty_lines: true
        },
        (err, rows) => {
          if (err) return reject(err);
          rows.forEach((row, index) => {
            records.push({ row, line: index + 2 });
          });
          resolve();
        }
      );
    });

    let imported = 0;

    for (const { row, line } of records) {
      try {
        const {
          nome,
          fabricante,
          localizacao,
          numero_serie,
          sistema_operacional,
          data_ultima_preventiva,
          data_proxima_preventiva
        } = row;

        if (!nome || !numero_serie || !localizacao || !sistema_operacional) {
          errors.push({ row: line, error: 'Campos obrigatórios ausentes' });
          continue;
        }

        let lastPreventiveDate = null;
        let nextPreventiveDate = null;

        if (data_ultima_preventiva) {
          const d = new Date(data_ultima_preventiva);
          if (isNaN(d)) {
            errors.push({ row: line, error: 'Data inválida em data_ultima_preventiva' });
            continue;
          }
          lastPreventiveDate = d;
        }

        if (data_proxima_preventiva) {
          const d = new Date(data_proxima_preventiva);
          if (isNaN(d)) {
            errors.push({ row: line, error: 'Data inválida em data_proxima_preventiva' });
            continue;
          }
          nextPreventiveDate = d;
        }

        const existing = await prisma.computer.findUnique({
          where: { serialNumber: numero_serie }
        });

        if (existing) {
          errors.push({ row: line, error: 'Número de série duplicado' });
          continue;
        }

        await prisma.computer.create({
          data: {
            name: nome,
            manufacturer: fabricante || null,
            location: localizacao || null,
            serialNumber: numero_serie,
            os: sistema_operacional,
            lastPreventiveDate,
            nextPreventiveDate
          }
        });

        imported += 1;
      } catch (err) {
        console.error(err);
        errors.push({ row: line, error: 'Erro desconhecido ao importar linha' });
      }
    }

    res.json({
      total_rows: records.length,
      imported,
      errors
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao importar CSV' });
  }
});

module.exports = router;
