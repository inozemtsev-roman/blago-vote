import { useEffect } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';

// Обёрнутый onStatusChange в @tonconnect/ui сначала делает
//   const info = await this.getSelectedWalletInfo(wallet)
// и только потом вызывает колбэк. Если getSelectedWalletInfo бросает
// (`Cannot find WalletInfo for the '<app>' wallet` или TDZ в бандле кошелька),
// промис отклоняется, колбэк не срабатывает — useTonWallet/useTonAddress
// остаются со старым значением, и кнопка профиля не обновляется, пока не
// нажмёшь её снова. Оборачиваем метод: ошибка обогащения не должна отменять
// уведомление подписчиков (адрес берётся из connector.wallet и так).
function makeSelectedWalletInfoSafe(tonConnectUI: unknown) {
    const ui = tonConnectUI as {
        __blagoSelectedWalletInfoPatched?: boolean;
        getSelectedWalletInfo?: (wallet: unknown) => Promise<unknown>;
    } | null;
    if (!ui || ui.__blagoSelectedWalletInfoPatched) return;

    const original = ui.getSelectedWalletInfo;
    if (typeof original !== "function") return;

    ui.__blagoSelectedWalletInfoPatched = true;
    ui.getSelectedWalletInfo = async (wallet: unknown) => {
        try {
            return await original.call(ui, wallet);
        } catch {
            return null;
        }
    };
}

export const TonConnectInitializer = () => {
    const [tonConnectUI, setOptions] = useTonConnectUI();

    useEffect(() => {
        setOptions({ language: 'ru' });
        makeSelectedWalletInfoSafe(tonConnectUI);
    }, [tonConnectUI]);

    return null;
}; 