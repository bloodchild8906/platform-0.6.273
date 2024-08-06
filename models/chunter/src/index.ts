//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
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

import activity, { type ActivityMessage } from '@hcengineering/activity'
import {
  type Channel,
  chunterId,
  type DirectMessage,
  type ChatMessage,
  type ChatMessageViewlet,
  type ChunterSpace,
  type ObjectChatPanel,
  type ThreadMessage,
  type ChatInfo,
  type ChannelInfo
} from '@hcengineering/chunter'
import presentation from '@hcengineering/model-presentation'
import contact, { type Person } from '@hcengineering/contact'
import {
  type Class,
  type Doc,
  type Domain,
  DOMAIN_MODEL,
  type Ref,
  type Timestamp,
  IndexKind
} from '@hcengineering/core'
import {
  type Builder,
  Collection as PropCollection,
  Index,
  Mixin,
  Model,
  Prop,
  TypeMarkup,
  TypeRef,
  TypeString,
  TypeTimestamp,
  UX,
  Hidden
} from '@hcengineering/model'
import attachment from '@hcengineering/model-attachment'
import core, { TClass, TDoc, TSpace } from '@hcengineering/model-core'
import notification, { TDocNotifyContext } from '@hcengineering/model-notification'
import view from '@hcengineering/model-view'
import workbench from '@hcengineering/model-workbench'
import type { IntlString } from '@hcengineering/platform'
import { TActivityMessage } from '@hcengineering/model-activity'
import { type DocNotifyContext } from '@hcengineering/notification'

import chunter from './plugin'
import { defineActions } from './actions'

export { chunterId } from '@hcengineering/chunter'
export { chunterOperation } from './migration'

export const DOMAIN_CHUNTER = 'chunter' as Domain

@Model(chunter.class.ChunterSpace, core.class.Space)
export class TChunterSpace extends TSpace implements ChunterSpace {}

@Model(chunter.class.Channel, chunter.class.ChunterSpace)
@UX(chunter.string.Channel, chunter.icon.Hashtag, undefined, undefined, undefined, chunter.string.Channels)
export class TChannel extends TChunterSpace implements Channel {
  @Prop(TypeString(), chunter.string.Topic)
  @Index(IndexKind.FullText)
    topic?: string
}

@Model(chunter.class.DirectMessage, chunter.class.ChunterSpace)
@UX(chunter.string.DirectMessage, contact.icon.Person, undefined, undefined, undefined, chunter.string.DirectMessages)
export class TDirectMessage extends TChunterSpace implements DirectMessage {}

@Model(chunter.class.ChatMessage, activity.class.ActivityMessage)
@UX(chunter.string.Message, chunter.icon.Thread, undefined, undefined, undefined, chunter.string.Threads)
export class TChatMessage extends TActivityMessage implements ChatMessage {
  @Prop(TypeMarkup(), chunter.string.Message)
  @Index(IndexKind.FullText)
    message!: string

  @Prop(TypeTimestamp(), chunter.string.Edit)
    editedOn?: Timestamp

  @Prop(PropCollection(attachment.class.Attachment), attachment.string.Attachments, {
    shortLabel: attachment.string.Files
  })
    attachments?: number
}

@Model(chunter.class.ThreadMessage, chunter.class.ChatMessage)
@UX(chunter.string.ThreadMessage, chunter.icon.Thread, undefined, undefined, undefined, chunter.string.Threads)
export class TThreadMessage extends TChatMessage implements ThreadMessage {
  @Prop(TypeRef(activity.class.ActivityMessage), core.string.AttachedTo)
  @Index(IndexKind.Indexed)
  declare attachedTo: Ref<ActivityMessage>

  @Prop(TypeRef(activity.class.ActivityMessage), core.string.AttachedToClass)
  @Index(IndexKind.Indexed)
  declare attachedToClass: Ref<Class<ActivityMessage>>

  @Prop(TypeRef(core.class.Doc), core.string.Object)
  @Index(IndexKind.Indexed)
    objectId!: Ref<Doc>

  @Prop(TypeRef(core.class.Class), core.string.Class)
  @Index(IndexKind.Indexed)
    objectClass!: Ref<Class<Doc>>
}

@Model(chunter.class.ChatMessageViewlet, core.class.Doc, DOMAIN_MODEL)
export class TChatMessageViewlet extends TDoc implements ChatMessageViewlet {
  @Prop(TypeRef(core.class.Doc), core.string.Class)
  @Index(IndexKind.Indexed)
    objectClass!: Ref<Class<Doc>>

  @Prop(TypeRef(core.class.Doc), core.string.Class)
  @Index(IndexKind.Indexed)
    messageClass!: Ref<Class<Doc>>

  label?: IntlString
  onlyWithParent?: boolean
}

@Mixin(chunter.mixin.ObjectChatPanel, core.class.Class)
export class TObjectChatPanel extends TClass implements ObjectChatPanel {
  ignoreKeys!: string[]
}

@Mixin(chunter.mixin.ChannelInfo, notification.class.DocNotifyContext)
export class TChannelInfo extends TDocNotifyContext implements ChannelInfo {
  @Hidden()
    hidden!: boolean
}

@Model(chunter.class.ChatInfo, core.class.Doc, DOMAIN_CHUNTER)
export class TChatInfo extends TDoc implements ChatInfo {
  user!: Ref<Person>
  hidden!: Ref<DocNotifyContext>[]
  timestamp!: Timestamp
}

export function createModel (builder: Builder): void {
  builder.createModel(
    TChunterSpace,
    TChannel,
    TDirectMessage,
    TChatMessage,
    TThreadMessage,
    TChatMessageViewlet,
    TObjectChatPanel,
    TChatInfo,
    TChannelInfo
  )
  const spaceClasses = [chunter.class.Channel, chunter.class.DirectMessage]

  builder.mixin(chunter.class.DirectMessage, core.class.Class, view.mixin.ObjectIcon, {
    component: chunter.component.DirectIcon
  })

  builder.mixin(chunter.class.Channel, core.class.Class, view.mixin.ObjectIcon, {
    component: chunter.component.ChannelIcon
  })

  spaceClasses.forEach((spaceClass) => {
    builder.mixin(spaceClass, core.class.Class, activity.mixin.ActivityDoc, {})

    builder.mixin(spaceClass, core.class.Class, view.mixin.LinkProvider, {
      encode: chunter.function.GetChunterSpaceLinkFragment
    })

    builder.mixin(spaceClass, core.class.Class, view.mixin.ObjectEditor, {
      editor: chunter.component.EditChannel
    })

    builder.mixin(spaceClass, core.class.Class, view.mixin.ObjectPanel, {
      component: chunter.component.ChannelPanel
    })
  })

  builder.mixin(chunter.class.DirectMessage, core.class.Class, view.mixin.ObjectTitle, {
    titleProvider: chunter.function.DirectTitleProvider
  })

  builder.mixin(chunter.class.Channel, core.class.Class, view.mixin.ObjectTitle, {
    titleProvider: chunter.function.ChannelTitleProvider
  })

  builder.mixin(chunter.class.DirectMessage, core.class.Class, notification.mixin.ClassCollaborators, {
    fields: ['members']
  })

  builder.mixin(chunter.class.Channel, core.class.Class, notification.mixin.ClassCollaborators, {
    fields: ['members']
  })

  builder.mixin(chunter.class.DirectMessage, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: chunter.component.DmPresenter
  })

  builder.mixin(chunter.class.DirectMessage, core.class.Class, notification.mixin.NotificationPreview, {
    presenter: chunter.component.ChannelPreview
  })

  builder.mixin(chunter.class.Channel, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: chunter.component.ChannelPresenter
  })

  builder.mixin(chunter.class.ChatMessage, core.class.Class, notification.mixin.NotificationContextPresenter, {
    labelPresenter: chunter.component.ChatMessageNotificationLabel
  })

  builder.createDoc(notification.class.ActivityNotificationViewlet, core.space.Model, {
    messageMatch: {
      _class: chunter.class.ThreadMessage
    },
    presenter: chunter.component.ThreadNotificationPresenter
  })

  builder.mixin(chunter.class.DirectMessage, core.class.Class, view.mixin.SpaceHeader, {
    header: chunter.component.DmHeader
  })

  builder.mixin(chunter.class.Channel, core.class.Class, view.mixin.SpaceHeader, {
    header: chunter.component.ChannelHeader
  })

  builder.createDoc(
    view.class.ActionCategory,
    core.space.Model,
    { label: chunter.string.Chat, visible: true },
    chunter.category.Chunter
  )

  builder.createDoc(
    view.class.Viewlet,
    core.space.Model,
    {
      attachTo: chunter.class.Channel,
      descriptor: view.viewlet.Table,
      configOptions: {
        strict: true
      },
      config: ['', 'topic', 'private', 'archived', 'members'],
      props: { enableChecking: false }
    },
    chunter.viewlet.Channels
  )

  builder.createDoc(
    workbench.class.Application,
    core.space.Model,
    {
      label: chunter.string.ApplicationLabelChunter,
      icon: chunter.icon.Chunter,
      alias: chunterId,
      hidden: false,
      component: chunter.component.Chat,
      aside: chunter.component.ChatAside
    },
    chunter.app.Chunter
  )

  builder.mixin(activity.class.ActivityMessage, core.class.Class, view.mixin.LinkProvider, {
    encode: chunter.function.GetMessageLink
  })

  builder.mixin(chunter.class.ThreadMessage, core.class.Class, view.mixin.LinkProvider, {
    encode: chunter.function.GetThreadLink
  })

  builder.mixin(chunter.class.Channel, core.class.Class, view.mixin.ClassFilters, {
    filters: []
  })

  builder.createDoc(
    notification.class.NotificationGroup,
    core.space.Model,
    {
      label: chunter.string.ApplicationLabelChunter,
      icon: chunter.icon.Chunter
    },
    chunter.ids.ChunterNotificationGroup
  )

  builder.createDoc(
    notification.class.NotificationType,
    core.space.Model,
    {
      label: chunter.string.DM,
      generated: false,
      hidden: false,
      txClasses: [core.class.TxCreateDoc],
      objectClass: chunter.class.ChatMessage,
      attachedToClass: chunter.class.DirectMessage,
      defaultEnabled: false,
      group: chunter.ids.ChunterNotificationGroup,
      templates: {
        textTemplate: '{sender} has sent you a message: {doc} {message}',
        htmlTemplate: '<p><b>{sender}</b> has sent you a message {doc}</p> {message}',
        subjectTemplate: 'You have new direct message in {doc}'
      }
    },
    chunter.ids.DMNotification
  )

  builder.createDoc(
    notification.class.NotificationType,
    core.space.Model,
    {
      label: chunter.string.Message,
      generated: false,
      hidden: false,
      txClasses: [core.class.TxCreateDoc],
      objectClass: chunter.class.ChatMessage,
      attachedToClass: chunter.class.Channel,
      defaultEnabled: false,
      group: chunter.ids.ChunterNotificationGroup,
      templates: {
        textTemplate: '{sender} has sent a message in {doc}: {message}',
        htmlTemplate: '<p><b>{sender}</b> has sent a message in {doc}</p> {message}',
        subjectTemplate: 'You have new message in {doc}'
      }
    },
    chunter.ids.ChannelNotification
  )

  builder.createDoc(
    notification.class.NotificationType,
    core.space.Model,
    {
      label: chunter.string.ThreadMessage,
      generated: false,
      hidden: false,
      txClasses: [core.class.TxCreateDoc],
      objectClass: chunter.class.ThreadMessage,
      defaultEnabled: false,
      group: chunter.ids.ChunterNotificationGroup,
      templates: {
        textTemplate: '{body}',
        htmlTemplate: '<p>{body}</p>',
        subjectTemplate: '{title}'
      }
    },
    chunter.ids.ThreadNotification
  )

  builder.createDoc(activity.class.ActivityMessagesFilter, core.space.Model, {
    label: chunter.string.Comments,
    position: 60,
    filter: chunter.filter.ChatMessagesFilter
  })

  builder.mixin(chunter.class.DirectMessage, core.class.Class, view.mixin.ObjectIdentifier, {
    provider: chunter.function.DmIdentifierProvider
  })

  builder.mixin(chunter.class.ChatMessage, core.class.Class, view.mixin.CollectionPresenter, {
    presenter: chunter.component.ChatMessagesPresenter
  })

  builder.mixin(chunter.class.ChatMessage, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: chunter.component.ChatMessagePresenter
  })

  builder.mixin(chunter.class.ChatMessage, core.class.Class, presentation.mixin.InstantTransactions, {
    txClasses: [core.class.TxCreateDoc]
  })

  builder.mixin(chunter.class.ThreadMessage, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: chunter.component.ThreadMessagePresenter
  })

  builder.createDoc(
    chunter.class.ChatMessageViewlet,
    core.space.Model,
    {
      messageClass: chunter.class.ThreadMessage,
      objectClass: chunter.class.ChatMessage,
      label: chunter.string.RepliedToThread
    },
    chunter.ids.ThreadMessageViewlet
  )

  builder.createDoc(activity.class.ActivityExtension, core.space.Model, {
    ofClass: chunter.class.Channel,
    components: { input: chunter.component.ChatMessageInput }
  })

  builder.createDoc(activity.class.ActivityExtension, core.space.Model, {
    ofClass: chunter.class.DirectMessage,
    components: { input: chunter.component.ChatMessageInput }
  })

  builder.createDoc(activity.class.ActivityExtension, core.space.Model, {
    ofClass: activity.class.DocUpdateMessage,
    components: { input: chunter.component.ChatMessageInput }
  })

  builder.createDoc(activity.class.ActivityExtension, core.space.Model, {
    ofClass: chunter.class.ChatMessage,
    components: { input: chunter.component.ChatMessageInput }
  })

  builder.createDoc(activity.class.ActivityExtension, core.space.Model, {
    ofClass: activity.class.ActivityReference,
    components: { input: chunter.component.ChatMessageInput }
  })

  builder.mixin(chunter.class.Channel, core.class.Class, chunter.mixin.ObjectChatPanel, {
    ignoreKeys: ['archived', 'collaborators', 'lastMessage', 'pinned', 'topic', 'description']
  })

  builder.mixin(chunter.class.DirectMessage, core.class.Class, chunter.mixin.ObjectChatPanel, {
    ignoreKeys: ['archived', 'collaborators', 'lastMessage', 'pinned', 'topic', 'description']
  })

  builder.mixin(chunter.class.ChatMessage, core.class.Class, activity.mixin.ActivityMessagePreview, {
    presenter: chunter.component.ChatMessagePreview
  })

  builder.mixin(chunter.class.ThreadMessage, core.class.Class, activity.mixin.ActivityMessagePreview, {
    presenter: chunter.component.ThreadMessagePreview
  })

  builder.createDoc(core.class.DomainIndexConfiguration, core.space.Model, {
    domain: DOMAIN_CHUNTER,
    disabled: [{ _class: 1 }, { space: 1 }, { modifiedBy: 1 }, { createdBy: 1 }, { createdOn: -1 }]
  })

  builder.createDoc(activity.class.ReplyProvider, core.space.Model, {
    function: chunter.function.ReplyToThread
  })

  builder.mixin(chunter.class.Channel, core.class.Class, view.mixin.ClassFilters, {
    filters: ['name', 'topic', 'private', 'archived', 'members'],
    strict: true
  })

  builder.createDoc(notification.class.NotificationProviderDefaults, core.space.Model, {
    provider: notification.providers.InboxNotificationProvider,
    ignoredTypes: [],
    enabledTypes: [chunter.ids.DMNotification, chunter.ids.ChannelNotification, chunter.ids.ThreadNotification]
  })

  builder.createDoc(notification.class.NotificationProviderDefaults, core.space.Model, {
    provider: notification.providers.PushNotificationProvider,
    ignoredTypes: [],
    enabledTypes: [chunter.ids.DMNotification, chunter.ids.ChannelNotification, chunter.ids.ThreadNotification]
  })

  defineActions(builder)
}

export default chunter
