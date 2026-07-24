const express = require('express');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

router.get('/', (req, res) => res.json({ success: true, data: [] }));
router.get('/history', (req, res) => res.json({ success: true, data: [] }));

module.exports = router;
