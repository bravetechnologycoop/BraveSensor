class Contact {
    constructor(id, name, organization, client_id, email, phoneNumber, tags) {
        this.contact_id = id
        this.name = name
        this.organization = organization
        this.client_id = client_id
        this.email = email
        this.phoneNumber = phoneNumber
        this.tags = tags
    }
}

module.exports = Contact