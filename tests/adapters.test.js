// tests/adapters.test.js —— 各平台 adapter 夹具回归
import '../adapters/registry.js';
import '../adapters/deepseek.js';
import { defineAdapterSuite } from './helpers.js';

defineAdapterSuite({
  adapterId: 'deepseek',
  hostname: 'chat.deepseek.com',
  fixture: 'deepseek.html',
  minAnswers: 2,
  fragments: ['量子计算发展史', '容错阈值'],
  questionFragment: '量子计算',
});
