import type { SchemaTypeDefinition } from 'sanity'
import { blockTypes, linkType } from './blocks'
import { page } from './page'

export const schemaTypes: SchemaTypeDefinition[] = [page, linkType, ...blockTypes]
