<?php
	header('Location: '.urldecode($_GET['url']));
	exit();

    $handler = curl_init(urldecode($_GET['url']));
    curl_setopt($handler, CURLOPT_RETURNTRANSFER,1);
    $obsah = curl_exec($handler);
    curl_close($handler);

    exit($obsah);
?>