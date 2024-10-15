const get_meta_content = (name: string): string => {
    const meta_element = document.querySelector(`meta[name="${name}"]`)
    if (meta_element === null)
        throw new Error(`Meta element with name "${name}" not found`);
    const meta_element_content = meta_element.getAttribute('content');
    if (meta_element_content === null)
        throw new Error(`Meta element with name "${name}" has no content`);
    return meta_element_content;
}

export const build_timestamp = get_meta_content('build-timestamp');
export const build_hash = get_meta_content('build-hash');