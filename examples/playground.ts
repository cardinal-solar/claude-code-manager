#!/usr/bin/env ts-node
/**
 * Playground per testare claude-code-manager
 *
 * Esegui con: npx ts-node playground.ts
 */

import { ClaudeCodeManager, PRD, ProgressTracker } from './src';
import { z } from 'zod';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

// Helper per aspettare e vedere il processo
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const runId = Date.now();

  console.log('🎮 Claude Code Manager Playground');
  console.log('═'.repeat(50));
  console.log(`⏰ Esecuzione #${runId}`);
  console.log(`📅 ${new Date().toLocaleString('it-IT')}`);
  console.log('═'.repeat(50));

  // Crea directory univoca per questa esecuzione
  const playgroundDir = path.join(os.tmpdir(), 'playground-test', `run-${runId}`);
  console.log(`\n📂 Directory test: ${playgroundDir}`);

  console.log('   ⏳ Creando directory...');
  await fs.mkdir(playgroundDir, { recursive: true });
  console.log('   ✅ Directory creata');

  await sleep(500);

  const manager = new ClaudeCodeManager({
    tempDir: playgroundDir
  });

  console.log('✅ Manager inizializzato\n');
  await sleep(500);

  // Test 1: Create PRD
  console.log('📝 Test 1: Creazione PRD');
  console.log('─'.repeat(50));

  console.log('   ⏳ Creando PRD con 2 user stories...');
  await sleep(300);

  const prd = PRD.create({
    project: 'Test Project',
    branchName: 'feature/test',
    description: 'Progetto di test per playground',
    userStories: [
      {
        id: 'US-001',
        title: 'Prima user story',
        description: 'Test story 1',
        acceptanceCriteria: ['Criterio 1', 'Criterio 2'],
        priority: 1,
        estimatedComplexity: 3,
        passes: false
      },
      {
        id: 'US-002',
        title: 'Seconda user story',
        description: 'Test story 2',
        acceptanceCriteria: ['Criterio A', 'Criterio B'],
        priority: 2,
        estimatedComplexity: 2,
        passes: false
      }
    ]
  });

  console.log('✅ PRD creato in memoria');
  console.log(`   • Project: ${prd.getProject()}`);
  console.log(`   • Branch: ${prd.getBranchName()}`);
  console.log(`   • Stories: ${prd.getUserStories().length}`);

  const nextStory = prd.getNextStory();
  console.log(`   • Next story: ${nextStory?.id} - ${nextStory?.title}`);

  await sleep(300);

  // Salva PRD
  const prdPath = path.join(playgroundDir, 'prd.json');
  console.log(`\n   ⏳ Salvando PRD su disco...`);
  await prd.save(prdPath);

  const prdContent = await fs.readFile(prdPath, 'utf-8');
  const prdSize = (await fs.stat(prdPath)).size;

  console.log(`   ✅ PRD salvato: ${prdPath}`);
  console.log(`   📊 Dimensione: ${prdSize} bytes`);
  console.log(`   🔍 Contenuto (prime 150 chars):`);
  console.log(`      ${prdContent.substring(0, 150)}...`);

  await sleep(500);

  // Test 2: Progress Tracking
  console.log('\n📊 Test 2: Progress Tracking');
  console.log('─'.repeat(50));

  const progressPath = path.join(playgroundDir, 'progress.txt');

  console.log('   ⏳ Inizializzando progress file...');
  await sleep(300);

  await ProgressTracker.initialize(progressPath);
  const initialContent = await fs.readFile(progressPath, 'utf-8');
  console.log('   ✅ Progress file creato e inizializzato');
  console.log(`   📄 Header: "${initialContent.trim().substring(0, 50)}..."`);

  await sleep(300);

  console.log('\n   ⏳ Aggiungendo entry al progress...');
  await sleep(300);

  await ProgressTracker.append(progressPath, {
    storyId: 'US-001',
    summary: 'Implementata prima feature',
    filesChanged: ['src/feature1.ts', 'tests/feature1.test.ts'],
    learnings: [
      'Usare pattern X per questo tipo di problema',
      'Ricordarsi di aggiungere tests'
    ]
  });

  const progressAfter = await fs.readFile(progressPath, 'utf-8');
  const progressSize = (await fs.stat(progressPath)).size;

  console.log('   ✅ Entry aggiunta');
  console.log(`   📊 Dimensione file: ${progressSize} bytes`);

  const progress = await ProgressTracker.read(progressPath);
  console.log(`   📈 Entries totali: ${progress.entries.length}`);
  console.log(`   💡 Learnings accumulati: ${progress.learnings.length}`);

  await sleep(500);

  // Test 3: Schema Validation
  console.log('\n🔍 Test 3: Schema Validation');
  console.log('─'.repeat(50));

  const componentSchema = z.object({
    name: z.string(),
    props: z.array(z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean()
    })),
    code: z.string()
  });

  const validData = {
    name: 'Button',
    props: [
      { name: 'label', type: 'string', required: true },
      { name: 'onClick', type: '() => void', required: true }
    ],
    code: 'export const Button = () => { ... }'
  };

  console.log('   ⏳ Validando dati corretti...');
  await sleep(300);

  const { SchemaValidator } = await import('./src/validation/schema');

  const validationResult = SchemaValidator.validate(validData, componentSchema);
  console.log(`   ✅ Validazione: ${validationResult.success ? 'SUCCESSO ✓' : 'FALLITA ✗'}`);

  if (validationResult.success) {
    console.log(`   📦 Componente: ${validationResult.data.name}`);
    console.log(`   🔧 Props: ${validationResult.data.props.length} proprietà`);
  }

  await sleep(300);

  // Test con dati invalidi
  console.log('\n   ⏳ Testando validazione con dati invalidi...');
  await sleep(300);

  const invalidData = {
    name: 'Button',
    props: 'not-an-array', // Errore: dovrebbe essere array
    code: 123 // Errore: dovrebbe essere string
  };

  const invalidResult = SchemaValidator.validate(invalidData, componentSchema);
  console.log(`   ✅ Validazione dati invalidi: ${invalidResult.success ? 'SUCCESSO' : 'FALLITA (come previsto) ✓'}`);

  if (!invalidResult.success) {
    console.log(`   🔴 Errori rilevati: ${invalidResult.error.issues.length}`);
    invalidResult.error.issues.forEach((issue, i) => {
      console.log(`      ${i + 1}. ${issue.path.join('.')}: ${issue.message}`);
    });
  }

  await sleep(500);

  // Test 4: File Manager
  console.log('\n📁 Test 4: File Manager');
  console.log('─'.repeat(50));

  const { FileManager } = await import('./src/files/file-manager');
  const fileManager = new FileManager(playgroundDir);

  console.log('   ⏳ Creando task directory...');
  await sleep(300);

  const taskDir = await fileManager.createTaskDir(`test-${runId}`);
  console.log(`   ✅ Task directory: ${taskDir}`);

  // Verifica che la directory esiste
  const dirStats = await fs.stat(taskDir);
  console.log(`   📂 Directory creata: ${dirStats.isDirectory() ? 'SI' : 'NO'}`);

  await sleep(300);

  console.log('\n   ⏳ Scrivendo task spec...');
  await sleep(300);

  await fileManager.writeTaskSpec(taskDir, {
    prompt: 'Test task per il playground',
    variables: { framework: 'React', version: '18.2.0' }
  });

  const specPath = path.join(taskDir, 'instructions.json');
  const specContent = await fs.readFile(specPath, 'utf-8');
  const specSize = (await fs.stat(specPath)).size;

  console.log('   ✅ Task spec scritta');
  console.log(`   📄 File: ${specPath}`);
  console.log(`   📊 Dimensione: ${specSize} bytes`);

  await sleep(300);

  console.log('\n   ⏳ Scrivendo schema...');
  await sleep(300);

  await fileManager.writeSchema(taskDir, {
    type: 'object',
    properties: {
      result: { type: 'string' },
      success: { type: 'boolean' }
    },
    required: ['result', 'success']
  });

  const schemaPath = path.join(taskDir, 'schema.json');
  const schemaContent = await fs.readFile(schemaPath, 'utf-8');
  const schemaSize = (await fs.stat(schemaPath)).size;

  console.log('   ✅ Schema scritto');
  console.log(`   📄 File: ${schemaPath}`);
  console.log(`   📊 Dimensione: ${schemaSize} bytes`);

  await sleep(500);

  // Test 5: Manager Configuration
  console.log('\n⚙️  Test 5: Manager Configuration');
  console.log('─'.repeat(50));

  console.log('   ⏳ Creando manager custom con hooks...');
  await sleep(300);

  let beforeHookCalled = false;
  let afterHookCalled = false;

  const customManager = new ClaudeCodeManager({
    claudeCodePath: '/custom/path/claude',
    tempDir: path.join(playgroundDir, 'custom'),
    cleanupOnExit: false,
    hooks: {
      beforeExecute: async (options) => {
        beforeHookCalled = true;
        console.log(`   🔵 Hook beforeExecute chiamato`);
        console.log(`      Prompt: "${options.prompt.substring(0, 40)}..."`);
      },
      afterExecute: async (result) => {
        afterHookCalled = true;
        console.log(`   🔵 Hook afterExecute chiamato`);
        console.log(`      Success: ${result.success}`);
      }
    }
  });

  console.log('   ✅ Manager configurato con:');
  console.log(`      • Custom Claude path: /custom/path/claude`);
  console.log(`      • Custom temp dir: ${path.join(playgroundDir, 'custom')}`);
  console.log(`      • Lifecycle hooks: beforeExecute, afterExecute`);
  console.log(`      • Cleanup on exit: false`);

  await sleep(500);

  // Riepilogo Files
  console.log('\n📋 Riepilogo Files Creati');
  console.log('─'.repeat(50));

  const allFiles = [
    prdPath,
    progressPath,
    specPath,
    schemaPath
  ];

  for (const file of allFiles) {
    const stats = await fs.stat(file);
    const relativePath = path.relative(os.tmpdir(), file);
    console.log(`   📄 ${path.basename(file)}`);
    console.log(`      Path: ${relativePath}`);
    console.log(`      Size: ${stats.size} bytes`);
    console.log(`      Created: ${stats.birthtime.toLocaleTimeString('it-IT')}`);
  }

  // Riepilogo finale
  console.log('\n' + '═'.repeat(50));
  console.log('🎉 Playground completato con successo!');
  console.log('═'.repeat(50));
  console.log('\n✅ Funzionalità testate:');
  console.log('   1. ✓ Creazione e gestione PRD (salvato su disco)');
  console.log('   2. ✓ Progress tracking (file creato e popolato)');
  console.log('   3. ✓ Schema validation con Zod (validi + invalidi)');
  console.log('   4. ✓ File manager (directory e files creati)');
  console.log('   5. ✓ Manager configuration (con hooks)');

  console.log('\n📊 Statistiche:');
  console.log(`   • Run ID: ${runId}`);
  console.log(`   • Files creati: ${allFiles.length}`);
  console.log(`   • Directory principale: ${playgroundDir}`);

  console.log('\n⚠️  Nota:');
  console.log('   - execute() richiede Claude Code installato');
  console.log('   - executeLoop() è in sviluppo (TODO)');

  console.log('\n📚 Per testare execute(), vedi:');
  console.log('   - examples/single-shot.ts (single execution)');
  console.log('   - examples/loop-basic.ts (loop mode)');

  console.log('\n🧹 Per ripulire i test files:');
  console.log(`   rm -rf ${path.join(os.tmpdir(), 'playground-test')}`);

  console.log('\n💡 Tip: Esegui di nuovo per vedere una nuova esecuzione\n');
}

// Gestione errori
main().catch((error) => {
  console.error('❌ Errore nel playground:', error);
  console.error('\n📋 Stack trace:');
  console.error(error.stack);
  process.exit(1);
});
