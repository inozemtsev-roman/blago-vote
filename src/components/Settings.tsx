import { Locales, useTonConnectUI } from '@tonconnect/ui-react';

export const Settings = () => {
    const [tonConnectUI, setOptions] = useTonConnectUI();

    const onLanguageChange = (lang: string) => {
        setOptions({ language: lang as Locales });
    };

    return (
        <div>
            <button onClick={() => onLanguageChange('ru')}>Русский</button>
            <button onClick={() => onLanguageChange('en')}>English</button>
        </div>
    );
}; 