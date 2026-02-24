import express from 'express';
import { login, logout, register, refreshSession } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/register', register);
router.post('/refresh', refreshSession);

export default router;