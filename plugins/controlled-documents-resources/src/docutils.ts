//
// Copyright © 2023 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//
import { get } from 'svelte/store'
import {
  type AttachedData,
  type Ref,
  type TxOperations,
  generateId,
  type Data,
  type MixinUpdate,
  type Hierarchy,
  type Class,
  type MixinData
} from '@hcengineering/core'
import { translate } from '@hcengineering/platform'
import { copyDocument, takeSnapshot } from '@hcengineering/presentation'
import { themeStore } from '@hcengineering/ui'
import documents, {
  type ControlledDocument,
  type Document,
  type DocumentSpace,
  type DocumentTemplate,
  type DocumentTraining,
  type ControlledDocumentSnapshot,
  type ChangeControl,
  type Project,
  DocumentState,
  getCollaborativeDocForDocument,
  createDocSections,
  createChangeControl
} from '@hcengineering/controlled-documents'
import documentsRes from './plugin'
import { getCurrentEmployee, getDocumentVersionString } from './utils'

export async function createNewDraftForControlledDoc (
  client: TxOperations,
  document: ControlledDocument,
  space: Ref<DocumentSpace>,
  version: { major: number, minor: number },
  project: Ref<Project>,
  newDraftDocId?: Ref<ControlledDocument>
): Promise<Ref<ControlledDocument>> {
  const hierarchy = client.getHierarchy()

  newDraftDocId = newDraftDocId ?? generateId()

  // Create new change control for new version
  const newCCId = generateId<ChangeControl>()
  const newCCSpec: Data<ChangeControl> = {
    description: '',
    reason: '',
    impact: '',
    impactedDocuments: []
  }

  await createChangeControl(client, newCCId, newCCSpec, document.space)

  const collaborativeDoc = getCollaborativeDocForDocument(
    `DOC-${document.prefix}`,
    document.seqNumber,
    document.major,
    document.minor,
    true
  )

  // TODO: copy labels?
  const docSpec: AttachedData<ControlledDocument> = {
    ...(document.template != null ? { template: document.template } : {}),
    ...(document.category != null ? { category: document.category } : {}),
    ...(document.owner != null ? { owner: document.owner } : {}),
    author: getCurrentEmployee(),
    title: document.title,
    code: document.code,
    prefix: document.prefix,
    seqNumber: document.seqNumber,
    major: version.major,
    minor: version.minor,
    commentSequence: 0,
    abstract: document.abstract ?? '',
    reviewers: document.reviewers,
    approvers: document.approvers,
    coAuthors: document.coAuthors,
    reviewInterval: document.reviewInterval,
    changeControl: newCCId,
    requests: 0,
    sections: 0,
    labels: 0,
    state: DocumentState.Draft,
    plannedEffectiveDate: 0,
    content: collaborativeDoc
  }

  const meta = await client.findOne(documents.class.ProjectMeta, {
    project,
    meta: document.attachedTo
  })

  if (meta !== undefined) {
    await client.addCollection(documents.class.ProjectDocument, meta.space, meta._id, meta._class, 'documents', {
      project,
      initial: project,
      document: newDraftDocId
    })
  } else {
    console.error('project meta not found', project)
  }

  await client.addCollection(
    document._class,
    space,
    document.attachedTo,
    document.attachedToClass,
    document.collection,
    docSpec,
    newDraftDocId
  )

  if (hierarchy.hasMixin(document, documents.mixin.DocumentTemplate)) {
    const template = hierarchy.as<Document, DocumentTemplate>(document, documents.mixin.DocumentTemplate)
    await client.updateMixin(newDraftDocId, documents.class.Document, space, documents.mixin.DocumentTemplate, {
      sequence: template.sequence,
      docPrefix: template.docPrefix
    })
  }

  if (document.content !== undefined) {
    await copyDocument(document.content, collaborativeDoc)
  }

  await createDocSections(client, newDraftDocId, document._id, space, documents.class.ControlledDocument)

  const documentTraining = getDocumentTraining(hierarchy, document)
  if (documentTraining !== undefined) {
    const newDraftDoc = await client.findOne(document._class, { _id: newDraftDocId })
    if (newDraftDoc === undefined) {
      console.error(`Document #${newDraftDocId} not found`)
    } else {
      await createDocumentTraining(client, newDraftDoc, {
        enabled: false,
        roles: documentTraining.roles,
        training: documentTraining.training,
        trainees: documentTraining.trainees,
        maxAttempts: documentTraining.maxAttempts,
        dueDays: documentTraining.dueDays
      })
    }
  }

  return newDraftDocId
}

export async function createDocumentSnapshotAndEdit (client: TxOperations, document: ControlledDocument): Promise<void> {
  const language = get(themeStore).language
  const namePrefix = await translate(documents.string.DraftRevision, {}, language)
  const name = `${namePrefix} ${(document.snapshots ?? 0) + 1}`
  const snapshot = await takeSnapshot(document.content, name)
  const newSnapshotId = generateId<ControlledDocumentSnapshot>()

  const op = client.apply(document._id)

  await op.addCollection(
    documents.class.ControlledDocumentSnapshot,
    document.space,
    document._id,
    document._class,
    'snapshots',
    {
      name,
      state: document.state,
      controlledState: document.controlledState,
      content: snapshot,
      sections: 0
    },
    newSnapshotId
  )

  await op.commit()

  await createDocSections(
    client,
    newSnapshotId,
    document._id,
    document.space,
    documents.class.ControlledDocumentSnapshot
  )

  await client.update(document, { controlledState: undefined })
}

export function getDocumentTrainingClass (hierarchy: Hierarchy): Class<DocumentTraining> {
  return hierarchy.getClass(documentsRes.mixin.DocumentTraining)
}

export function getDocumentTraining (hierarchy: Hierarchy, document: ControlledDocument): DocumentTraining | undefined {
  return hierarchy.hasMixin(document, documents.mixin.DocumentTraining)
    ? hierarchy.as<Document, DocumentTraining>(document, documents.mixin.DocumentTraining)
    : undefined
}

export async function createDocumentTraining (
  client: TxOperations,
  document: ControlledDocument,
  create: MixinData<Document, DocumentTraining>
): Promise<void> {
  await client.createMixin<Document, DocumentTraining>(
    document._id,
    document._class,
    document.space,
    documents.mixin.DocumentTraining,
    create
  )
}

export async function updateDocumentTraining (
  client: TxOperations,
  document: ControlledDocument,
  update: MixinUpdate<Document, DocumentTraining>
): Promise<void> {
  await client.updateMixin<Document, DocumentTraining>(
    document._id,
    document._class,
    document.space,
    documents.mixin.DocumentTraining,
    update
  )
}

export function getDocReference (doc: Document | null): string {
  if (doc == null) {
    return ''
  }

  return `${doc.code} ${getDocumentVersionString(doc)}`
}
