import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import Input, { Props as InputProps } from './Input';

interface Props extends Omit<InputProps, 'type'> { }

const PasswordInput: React.FunctionComponent<Props> = ({ ...props }) => {
    const [obfuscate, setObfuscate] = useState(false);
    const toggle_obfuscation = React.useCallback(() => {
        setObfuscate(!obfuscate);
    }, [obfuscate]);
    return (
        <div className="input-group">
            <Input type={obfuscate ? 'text' : 'password'} {...props} className="form-control" />
            <div className="input-group-append">
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={toggle_obfuscation}
                >
                    <FontAwesomeIcon icon={obfuscate ? faEye : faEyeSlash} />
                </button>
            </div>
        </div>
    );
};

export default PasswordInput;
