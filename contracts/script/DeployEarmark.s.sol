// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../Earmark.sol";

/**
 * Deploy Earmark to Arc Testnet.
 *
 *   export DEPLOYER_PRIVATE_KEY=0x...
 *   forge script contracts/script/DeployEarmark.s.sol:DeployEarmarkTestnet \
 *     --rpc-url https://rpc.testnet.arc.io \
 *     --broadcast \
 *     --verify \
 *     --legacy
 *
 * The deployed address is printed to stdout.
 */
contract DeployEarmarkTestnet is Script {
    // USDC on Arc Testnet
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        Earmark earmark = new Earmark(USDC);
        vm.stopBroadcast();

        console2.log("=== Earmark deployed to Arc Testnet ===");
        console2.log("Deployer:  ", deployer);
        console2.log("Contract:  ", address(earmark));
        console2.log("USDC:      ", USDC);
        console2.log("ChainId:   5042002");
        console2.log("Explorer:  https://explorer.testnet.arc.io/address/", address(earmark));
    }
}

/**
 * Deploy Earmark to Arc Mainnet.
 *
 * IMPORTANT: Transactions on mainnet involve real funds and are irreversible.
 * Review and test on testnet first. You are solely responsible for the outcome.
 *
 *   export DEPLOYER_PRIVATE_KEY=0x...
 *   forge script contracts/script/DeployEarmark.s.sol:DeployEarmarkMainnet \
 *     --rpc-url https://rpc.mainnet.arc.io \
 *     --broadcast \
 *     --verify \
 *     --legacy
 */
contract DeployEarmarkMainnet is Script {
    // USDC on Arc Mainnet (same address as testnet)
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        Earmark earmark = new Earmark(USDC);
        vm.stopBroadcast();

        console2.log("=== Earmark deployed to Arc Mainnet ===");
        console2.log("Deployer:  ", deployer);
        console2.log("Contract:  ", address(earmark));
        console2.log("USDC:      ", USDC);
        console2.log("ChainId:   5042");
        console2.log("Explorer:  https://explorer.arc.io/address/", address(earmark));
    }
}
