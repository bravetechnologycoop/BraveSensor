/**
 * Product: class for defining Product objects retrieved from the Particle API
 * Abstraction for representing product families in a Particle account.
 */
export default class Product {
  name

  id

  deviceType

  constructor(name, id, platform_id) {
    this.name = name
    this.id = id
    switch (platform_id) {
      case 3:
        this.deviceType = 'GCC'
        break
      case 6:
        this.deviceType = 'Photon'
        break
      case 8:
        this.deviceType = 'P1'
        break
      case 10:
        this.deviceType = 'Electron'
        break
      case 12:
        this.deviceType = 'Argon'
        break
      case 13:
        this.deviceType = 'Boron'
        break
      case 22:
        this.deviceType = 'ASOM'
        break
      case 23:
        this.deviceType = 'BSOM'
        break
      case 25:
        this.deviceType = 'B5SOM'
        break
      case 26:
        this.deviceType = 'Tracker'
        break
      case 60000:
        this.deviceType = 'Newhal'
        break
      default:
        this.deviceType = 'Unknown'
        break
    }
  }
}
