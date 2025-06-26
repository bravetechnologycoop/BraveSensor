// TODO rename to ClientExtension, remove suffix in all references

class ClientExtension {
  constructor(clientId, country, countrySubdivision, buildingType, createdAt, updatedAt, city, postalCode, funder, project, organization) {
    this.clientId = clientId
    this.country = country
    this.countrySubdivision = countrySubdivision
    this.buildingType = buildingType
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.city = city
    this.postalCode = postalCode
    this.funder = funder
    this.project = project
    this.organization = organization
  }
}

module.exports = ClientExtension
