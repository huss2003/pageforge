#!/usr/bin/env node
// Runs the TypeScript CLI through tsx so CI needs no build step.
import { register } from 'tsx/esm/api'

register()
process.env.PAGEFORGE_QA_CLI = '1'
await import('../src/run.ts')
