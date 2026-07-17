import { EventEmitter } from 'events'

const eventEmitter = new EventEmitter()
eventEmitter.setMaxListeners(100)

export default eventEmitter
