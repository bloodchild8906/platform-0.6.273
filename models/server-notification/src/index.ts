//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2022 Hardcore Engineering Inc.
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

import { type Builder, Mixin, Model } from '@hcengineering/model'

import core, { type Account, type Doc, type Ref, type Tx } from '@hcengineering/core'
import { TClass, TDoc } from '@hcengineering/model-core'
import { TNotificationType } from '@hcengineering/model-notification'
import notification, { type NotificationProvider, type NotificationType } from '@hcengineering/notification'
import { type Resource } from '@hcengineering/platform'
import serverCore, { type TriggerControl } from '@hcengineering/server-core'
import serverNotification, {
  type HTMLPresenter,
  type NotificationPresenter,
  type Presenter,
  type TextPresenter,
  type TypeMatch,
  type NotificationContentProvider,
  type NotificationProviderResources,
  type NotificationProviderFunc
} from '@hcengineering/server-notification'

export { serverNotificationId } from '@hcengineering/server-notification'

@Mixin(serverNotification.mixin.HTMLPresenter, core.class.Class)
export class THTMLPresenter extends TClass implements HTMLPresenter {
  presenter!: Resource<Presenter>
}

@Mixin(serverNotification.mixin.TextPresenter, core.class.Class)
export class TTextPresenter extends TClass implements TextPresenter {
  presenter!: Resource<Presenter>
}

@Mixin(serverNotification.mixin.NotificationPresenter, core.class.Class)
export class TNotificationPresenter extends TClass implements NotificationPresenter {
  presenter!: Resource<NotificationContentProvider>
}

@Mixin(serverNotification.mixin.TypeMatch, notification.class.NotificationType)
export class TTypeMatch extends TNotificationType implements TypeMatch {
  func!: Resource<
  (tx: Tx, doc: Doc, user: Ref<Account>, type: NotificationType, control: TriggerControl) => Promise<boolean>
  >
}

@Model(serverNotification.class.NotificationProviderResources, core.class.Doc)
export class TNotificationProviderResources extends TDoc implements NotificationProviderResources {
  provider!: Ref<NotificationProvider>
  fn!: Resource<NotificationProviderFunc>
}

export function createModel (builder: Builder): void {
  builder.createModel(
    THTMLPresenter,
    TTextPresenter,
    TTypeMatch,
    TNotificationPresenter,
    TNotificationProviderResources
  )

  builder.createDoc(serverCore.class.Trigger, core.space.Model, {
    trigger: serverNotification.trigger.OnActivityNotificationViewed,
    txMatch: {
      _class: core.class.TxUpdateDoc,
      objectClass: notification.class.ActivityInboxNotification
    }
  })

  builder.createDoc(serverCore.class.Trigger, core.space.Model, {
    trigger: serverNotification.trigger.OnAttributeCreate,
    txMatch: {
      objectClass: core.class.Attribute,
      _class: core.class.TxCreateDoc
    }
  })

  builder.createDoc(serverCore.class.Trigger, core.space.Model, {
    trigger: serverNotification.trigger.OnAttributeUpdate,
    txMatch: {
      objectClass: core.class.Attribute,
      _class: core.class.TxUpdateDoc
    }
  })

  builder.createDoc(serverCore.class.Trigger, core.space.Model, {
    trigger: serverNotification.trigger.OnDocRemove
  })
}