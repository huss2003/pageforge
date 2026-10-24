import { DocumentsIcon } from '@sanity/icons/Documents'
import { EarthGlobeIcon } from '@sanity/icons/EarthGlobe'
import { HomeIcon } from '@sanity/icons/Home'
import { RocketIcon } from '@sanity/icons/Rocket'
import { SparklesIcon } from '@sanity/icons/Sparkles'
import type { StructureResolver } from 'sanity/structure'
import { pageDocumentId } from './env'

/**
 * Studio navigation grouped the way marketing thinks about the site,
 * not by document type: the home page, site pages, industries, case
 * studies, then campaign pages (where Factory output lands).
 */
export const structure: StructureResolver = (S) => {
  const pagesOfKind = (title: string, kind: string, icon: typeof DocumentsIcon) =>
    S.listItem()
      .title(title)
      .icon(icon)
      .child(
        S.documentTypeList('page')
          .title(title)
          .filter('_type == "page" && kind == $kind')
          .params({ kind })
          .initialValueTemplates([S.initialValueTemplateItem('page-of-kind', { kind })]),
      )

  return S.list()
    .title('Hoverline site')
    .items([
      S.listItem()
        .title('Home page')
        .icon(HomeIcon)
        .child(
          S.document().schemaType('page').documentId(pageDocumentId('home')).title('Home page'),
        ),
      S.divider(),
      pagesOfKind('Site pages', 'page', DocumentsIcon),
      pagesOfKind('Platform', 'platform', DocumentsIcon),
      pagesOfKind('Industries', 'industry', EarthGlobeIcon),
      pagesOfKind('Case studies', 'caseStudy', DocumentsIcon),
      S.divider(),
      pagesOfKind('Campaign landing pages', 'landing', RocketIcon),
      S.listItem()
        .title('Written by the Factory')
        .icon(SparklesIcon)
        .child(
          S.documentTypeList('page')
            .title('Written by the Factory')
            .filter('_type == "page" && defined(generatedBy.runId)'),
        ),
      S.divider(),
      S.documentTypeListItem('page').title('All pages'),
    ])
}
