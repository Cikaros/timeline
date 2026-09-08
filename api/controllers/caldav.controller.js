import { handleCalDav } from '../services/caldav.service.js'

export const caldavController = {
  handle(req, context) {
    return handleCalDav(req, context)
  }
}
