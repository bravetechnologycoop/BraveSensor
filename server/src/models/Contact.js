class Contact {
  constructor(
    id,
    name,
    organization,
    client_id,
    email,
    phoneNumber,
    notes,
    shippingAddress,
    lastTouchpoint,
    shippingDate,
    tags,
    createdAt,
    updatedAt,
  ) {
    this.contact_id = id
    this.name = name
    this.organization = organization
    this.client_id = client_id
    this.email = email
    this.phoneNumber = phoneNumber
    this.notes = notes
    this.shippingAddress = shippingAddress
    this.lastTouchpoint = lastTouchpoint
    this.shippingDate = shippingDate
    this.tags = tags
    this.created_at = createdAt
    this.updated_at = updatedAt
  }
}

module.exports = Contact
