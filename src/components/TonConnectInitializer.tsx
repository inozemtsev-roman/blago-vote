import { useEffect } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';

export const TonConnectInitializer = () => {
    const [tonConnectUI, setOptions] = useTonConnectUI();

    useEffect(() => {
        setOptions({ language: 'ru' });
    }, []);

    return null;
}; 