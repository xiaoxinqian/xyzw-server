const express = require('express');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

router.get('/', (req, res) => res.json({ success: true, data: {} }));
router.put('/', adminRequired, (req, res) => res.json({ success: false, message: '待实现' }));

module.exports = router;
