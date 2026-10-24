/**
 * Host half of the dsh-term-explainer bundle.
 *
 * The feature is entirely browser-side: the Client module scans assistant text
 * against a bundled offline dictionary and renders an action + overlay panel.
 * Therefore the Host plugin only needs to exist so the bundle patch can mount
 * its row; loading it must stay side-effect free.
 */
export function apply() {}
