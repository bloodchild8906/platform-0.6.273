//
// Copyright © 2022 Hardcore Engineering Inc.
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

import contact, { Channel, formatName } from '@hcengineering/contact'
import {
  Account,
  Class,
  concatLink,
  Doc,
  DocumentQuery,
  FindOptions,
  FindResult,
  Hierarchy,
  Ref,
  Tx,
  TxCreateDoc,
  TxProcessor
} from '@hcengineering/core'
import gmail, { Message } from '@hcengineering/gmail'
import { TriggerControl } from '@hcengineering/server-core'
import notification, { BaseNotificationType, InboxNotification, NotificationType } from '@hcengineering/notification'
import serverNotification, { NotificationProviderFunc, UserInfo } from '@hcengineering/server-notification'
import { getContentByTemplate } from '@hcengineering/server-notification-resources'
import { getMetadata } from '@hcengineering/platform'

/**
 * @public
 */
export async function FindMessages (
  doc: Doc,
  hiearachy: Hierarchy,
  findAll: <T extends Doc>(
    clazz: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ) => Promise<FindResult<T>>
): Promise<Doc[]> {
  const channel = doc as Channel
  if (channel.provider !== contact.channelProvider.Email) {
    return []
  }
  const messages = await findAll(gmail.class.Message, { attachedTo: channel._id })
  const newMessages = await findAll(gmail.class.NewMessage, { attachedTo: channel._id })
  return [...messages, ...newMessages]
}

/**
 * @public
 */
export async function OnMessageCreate (tx: Tx, control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []

  const createTx = tx as TxCreateDoc<Message>

  const message = TxProcessor.createDoc2Doc<Message>(createTx)

  const channel = (await control.findAll(contact.class.Channel, { _id: message.attachedTo }, { limit: 1 }))[0]
  if (channel !== undefined) {
    if (channel.lastMessage === undefined || channel.lastMessage < message.sendOn) {
      const tx = control.txFactory.createTxUpdateDoc(channel._class, channel.space, channel._id, {
        lastMessage: message.sendOn
      })
      res.push(tx)
    }
    if (message.incoming) {
      const docs = await control.findAll(notification.class.DocNotifyContext, {
        attachedTo: channel._id,
        user: message.modifiedBy
      })
      for (const doc of docs) {
        // TODO: push inbox notification
        // res.push(
        //   control.txFactory.createTxUpdateDoc(doc._class, doc.space, doc._id, {
        //     $push: {
        //       txes: {
        //         _id: tx._id as Ref<TxCUD<Doc>>,
        //         modifiedOn: tx.modifiedOn,
        //         modifiedBy: tx.modifiedBy,
        //         isNew: true
        //       }
        //     }
        //   })
        // )
        res.push(
          control.txFactory.createTxUpdateDoc(doc._class, doc.space, doc._id, {
            lastUpdateTimestamp: tx.modifiedOn
          })
        )
      }
      if (docs.length === 0) {
        res.push(
          control.txFactory.createTxCreateDoc(notification.class.DocNotifyContext, channel.space, {
            user: tx.modifiedBy,
            attachedTo: channel._id,
            attachedToClass: channel._class,
            lastUpdateTimestamp: tx.modifiedOn
            // TODO: push inbox notification
            // txes: [
            //   { _id: tx._id as Ref<TxCUD<Doc>>, modifiedOn: tx.modifiedOn, modifiedBy: tx.modifiedBy, isNew: true }
            // ]
          })
        )
      }
    }
  }

  return res
}

/**
 * @public
 */
export async function IsIncomingMessage (
  tx: Tx,
  doc: Doc,
  user: Ref<Account>,
  type: NotificationType,
  control: TriggerControl
): Promise<boolean> {
  const message = TxProcessor.createDoc2Doc(TxProcessor.extractTx(tx) as TxCreateDoc<Message>)
  return message.incoming && message.sendOn > (doc.createdOn ?? doc.modifiedOn)
}

export async function sendEmailNotification (
  text: string,
  html: string,
  subject: string,
  receiver: string
): Promise<void> {
  try {
    const sesURL = getMetadata(serverNotification.metadata.SesUrl)
    if (sesURL === undefined || sesURL === '') {
      console.log('Please provide email service url to enable email confirmations.')
      return
    }
    await fetch(concatLink(sesURL, '/send'), {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        html,
        subject,
        to: [receiver]
      })
    })
  } catch (err) {
    console.log('Could not send email notification', err)
  }
}

async function notifyByEmail (
  control: TriggerControl,
  type: Ref<BaseNotificationType>,
  doc: Doc | undefined,
  sender: UserInfo,
  receiver: UserInfo,
  data: InboxNotification
): Promise<void> {
  const account = receiver.account

  if (account === undefined) {
    return
  }

  const senderPerson = sender.person
  const senderName = senderPerson !== undefined ? formatName(senderPerson.name, control.branding?.lastNameFirst) : ''

  const content = await getContentByTemplate(doc, senderName, type, control, '', data)

  if (content !== undefined) {
    await sendEmailNotification(content.text, content.html, content.subject, account.email)
  }
}

const SendEmailNotifications: NotificationProviderFunc = async (
  control: TriggerControl,
  types: BaseNotificationType[],
  object: Doc,
  data: InboxNotification,
  receiver: UserInfo,
  sender: UserInfo
): Promise<Tx[]> => {
  if (types.length === 0) {
    return []
  }

  if (receiver.person === undefined) {
    return []
  }

  const isEmployee = control.hierarchy.hasMixin(receiver.person, contact.mixin.Employee)

  if (!isEmployee) {
    return []
  }

  const employee = control.hierarchy.as(receiver.person, contact.mixin.Employee)

  if (!employee.active) {
    return []
  }

  for (const type of types) {
    await notifyByEmail(control, type._id, object, sender, receiver, data)
  }

  return []
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async () => ({
  trigger: {
    OnMessageCreate
  },
  function: {
    IsIncomingMessage,
    FindMessages,
    SendEmailNotifications
  }
})
