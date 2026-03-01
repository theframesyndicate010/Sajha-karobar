import express from 'express';
import { login, logout, register, refreshSession, forgotPassword, resetPassword } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/register', register);
router.post('/refresh', refreshSession);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;