import { v4 as uuid } from 'uuid';

const get_meta_content_or_default = (name: string, default_value: string): string => {
    const meta_element = document.querySelector(`meta[name="${name}"]`)
    if (meta_element === null)
        return default_value;
    const meta_element_content = meta_element.getAttribute('content');
    if (meta_element_content === null)
        return default_value;
    return meta_element_content;
}

export const build_timestamp = get_meta_content_or_default('build-timestamp', new Date().toISOString());
export const build_hash = get_meta_content_or_default('build-hash', uuid());