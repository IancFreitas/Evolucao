// Ponto de entrada. Arquitetura:
//   src/core      regras de evolução (puras, testáveis, sem DOM)
//   src/storage   persistência local, migrações e backups
//   src/services  notificações e integrações
//   src/ui        interface (casca, telas e componentes)
import { start } from './ui/app.js';

start();
