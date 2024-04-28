interface ActionExternalLink {
    type: "external_link"
    external_link: string
}

interface ActionInternalLink {
    type: "internal_link"
    internal_link: string
}

type Action = ActionExternalLink | ActionInternalLink