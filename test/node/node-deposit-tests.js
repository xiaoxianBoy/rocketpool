import { printTitle } from '../_utils/formatting';
import { shouldRevert } from '../_utils/testing';
import {
    RocketDAONodeTrustedSettingsMinipool,
    RocketDAOProtocolSettingsMinipool,
    RocketDAOProtocolSettingsNode,
    RocketMinipoolDelegate,
} from '../_utils/artifacts';
import { setDAOProtocolBootstrapSetting } from '../dao/scenario-dao-protocol-bootstrap';
import { getMinipoolMinimumRPLStake, stakeMinipool } from '../_helpers/minipool';
import { getNodeFee } from '../_helpers/network';
import { registerNode, setNodeTrusted, nodeStakeRPL } from '../_helpers/node';
import { mintRPL } from '../_helpers/tokens';
import { depositV2 } from './scenario-deposit-v2';
import { upgradeOneDotTwo } from '../_utils/upgrade';
import { reduceBond } from '../minipool/scenario-reduce-bond';
import { userDeposit } from '../_helpers/deposit';
import { increaseTime } from '../_utils/evm';
import { setDAONodeTrustedBootstrapSetting } from '../dao/scenario-dao-node-trusted-bootstrap';

export default function() {
    contract('RocketNodeDeposit', async (accounts) => {

        // Accounts
        const [
            owner,
            node,
            trustedNode,
            random,
        ] = accounts;

        // Setup
        let launchTimeout =  (60 * 60 * 72); // 72 hours
        let bondReductionWindowStart = (2 * 24 * 60 * 60)
        let bondReductionWindowLength = (2 * 24 * 60 * 60)
        let noMinimumNodeFee = web3.utils.toWei('0', 'ether');
        let lebDepositNodeAmount;
        let halfDepositNodeAmount;

        before(async () => {
            // Upgrade
            await upgradeOneDotTwo(owner)

            // Set settings
            await setDAOProtocolBootstrapSetting(RocketDAOProtocolSettingsMinipool, 'minipool.launch.timeout', launchTimeout, {from: owner});
            await setDAONodeTrustedBootstrapSetting(RocketDAONodeTrustedSettingsMinipool, 'minipool.bond.reduction.window.start', bondReductionWindowStart, {from: owner});
            await setDAONodeTrustedBootstrapSetting(RocketDAONodeTrustedSettingsMinipool, 'minipool.bond.reduction.window.length', bondReductionWindowLength, {from: owner});

            // Register node
            await registerNode({from: node});

            // Register trusted node
            await registerNode({from: trustedNode});
            await setNodeTrusted(trustedNode, 'saas_1', 'node@home.com', owner);

            // Get settings
            lebDepositNodeAmount = web3.utils.toWei('8', 'ether')
            halfDepositNodeAmount = web3.utils.toWei('16', 'ether')
        });


        it(printTitle('node operator', 'can make a deposit to create a minipool'), async () => {

            // Stake RPL to cover minipools
            let minipoolRplStake = await getMinipoolMinimumRPLStake();
            let rplStake = minipoolRplStake.mul(web3.utils.toBN(3));
            await mintRPL(owner, node, rplStake);
            await nodeStakeRPL(rplStake, {from: node});

            // Deposit
            await depositV2(noMinimumNodeFee, lebDepositNodeAmount, {
                from: node,
                value: lebDepositNodeAmount,
            });

            // Deposit
            await depositV2(noMinimumNodeFee, halfDepositNodeAmount, {
                from: node,
                value: halfDepositNodeAmount,
            });

        });


        it(printTitle('node operator', 'cannot make a deposit while deposits are disabled'), async () => {

            // Stake RPL to cover minipool
            let rplStake = await getMinipoolMinimumRPLStake();
            await mintRPL(owner, node, rplStake);
            await nodeStakeRPL(rplStake, {from: node});

            // Disable deposits
            await setDAOProtocolBootstrapSetting(RocketDAOProtocolSettingsNode, 'node.deposit.enabled', false, {from: owner});

            // Attempt deposit
            await shouldRevert(depositV2(noMinimumNodeFee, lebDepositNodeAmount, {
                from: node,
                value: lebDepositNodeAmount,
            }), 'Made a deposit while deposits were disabled');

            // Attempt deposit
            await shouldRevert(depositV2(noMinimumNodeFee, halfDepositNodeAmount, {
                from: node,
                value: halfDepositNodeAmount,
            }), 'Made a deposit while deposits were disabled');

        });


        it(printTitle('node operator', 'cannot make a deposit with a minimum node fee exceeding the current network node fee'), async () => {

            // Stake RPL to cover minipool
            let rplStake = await getMinipoolMinimumRPLStake();
            await mintRPL(owner, node, rplStake);
            await nodeStakeRPL(rplStake, {from: node});

            // Settings
            let nodeFee = await getNodeFee();
            let minimumNodeFee = nodeFee.add(web3.utils.toBN(web3.utils.toWei('0.01', 'ether')));

            // Attempt deposit
            await shouldRevert(depositV2(minimumNodeFee, lebDepositNodeAmount, {
                from: node,
                value: lebDepositNodeAmount,
            }), 'Made a deposit with a minimum node fee exceeding the current network node fee');

            // Attempt deposit
            await shouldRevert(depositV2(minimumNodeFee, halfDepositNodeAmount, {
                from: node,
                value: halfDepositNodeAmount,
            }), 'Made a deposit with a minimum node fee exceeding the current network node fee');

        });


        it(printTitle('node operator', 'cannot make a deposit with an invalid amount'), async () => {

            // Stake RPL to cover minipool
            let rplStake = await getMinipoolMinimumRPLStake();
            await mintRPL(owner, node, rplStake);
            await nodeStakeRPL(rplStake, {from: node});

            // Get deposit amount
            let depositAmount = web3.utils.toBN(web3.utils.toWei('10', 'ether'));
            assert(!depositAmount.eq(lebDepositNodeAmount), 'Deposit amount is not invalid');
            assert(!depositAmount.eq(halfDepositNodeAmount), 'Deposit amount is not invalid');

            // Attempt deposit
            await shouldRevert(depositV2(noMinimumNodeFee, depositAmount, {
                from: node,
                value: depositAmount,
            }), 'Made a deposit with an invalid deposit amount');

        });


        it(printTitle('node operator', 'cannot make a deposit with insufficient RPL staked'), async () => {

            // Attempt deposit with no RPL staked
            await shouldRevert(depositV2(noMinimumNodeFee, lebDepositNodeAmount, {
                from: node,
                value: lebDepositNodeAmount,
            }), 'Made a deposit with insufficient RPL staked');

            // Stake insufficient RPL amount
            let minipoolRplStake = await getMinipoolMinimumRPLStake();
            let rplStake = minipoolRplStake.div(web3.utils.toBN(2));
            await mintRPL(owner, node, rplStake);
            await nodeStakeRPL(rplStake, {from: node});

            // Attempt deposit with insufficient RPL staked
            await shouldRevert(depositV2(noMinimumNodeFee, lebDepositNodeAmount, {
                from: node,
                value: lebDepositNodeAmount,
            }), 'Made a deposit with insufficient RPL staked');

        });


        it(printTitle('random address', 'cannot make a deposit'), async () => {

            // Attempt deposit
            await shouldRevert(depositV2(noMinimumNodeFee, lebDepositNodeAmount, {
                from: random,
                value: lebDepositNodeAmount,
            }), 'Random address made a deposit');

            // Attempt deposit
            await shouldRevert(depositV2(noMinimumNodeFee, halfDepositNodeAmount, {
                from: random,
                value: halfDepositNodeAmount,
            }), 'Random address made a deposit');

        });


        it(printTitle('node operator', 'can make a deposit to create a minipool using deposit credit'), async () => {

            // Stake RPL to cover minipools
            let minipoolRplStake = await getMinipoolMinimumRPLStake();
            let rplStake = minipoolRplStake.mul(web3.utils.toBN(3));
            await mintRPL(owner, node, rplStake);
            await nodeStakeRPL(rplStake, {from: node});

            // Create a 16 ETH minipool
            await userDeposit({ from: random, value: web3.utils.toWei('24', 'ether'), });
            const minipoolAddress = await depositV2(noMinimumNodeFee, halfDepositNodeAmount, {
                from: node,
                value: halfDepositNodeAmount,
            });
            const minipool = await RocketMinipoolDelegate.at(minipoolAddress);

            // Stake the minipool
            await increaseTime(web3, launchTimeout + 1);
            await stakeMinipool(minipool, {from: node});

            // Signal wanting to reduce and wait 7 days
            await minipool.beginReduceBondAmount({from: node});
            await increaseTime(web3, bondReductionWindowStart + 1);

            // Reduce the bond to 8 ether to receive a deposit credit
            await reduceBond(minipool, web3.utils.toWei('8', 'ether'), {from: node});

            // Create an 8 ether minipool (using 8 ether from credit)
            await depositV2(noMinimumNodeFee, lebDepositNodeAmount, {
                from: node,
                value: web3.utils.toBN('0')
            });
        });


    });
}
